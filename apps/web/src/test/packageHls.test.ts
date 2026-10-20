import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachPackageHls, packageHlsUrl } from '../shared/player/packageHls';

const MAP = { '/contents/B/05/B0502/001/04/video/lect.mp4': '/contents-hls/B/05/B0502/001/04/video/lect/v1-0123456789/master.m3u8' };

describe('packaged lesson HLS swap', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('maps a source as the page wrote it, relative to the section page', () => {
    const base = 'https://timeless.uz/contents/B/05/B0502/001/04/index.html';
    expect(packageHlsUrl(MAP, './video/lect.mp4', base)).toBe(MAP['/contents/B/05/B0502/001/04/video/lect.mp4']);
    expect(packageHlsUrl(MAP, '/contents/B/05/B0502/001/04/video/lect.mp4', base)).toBe(MAP['/contents/B/05/B0502/001/04/video/lect.mp4']);
    expect(packageHlsUrl(MAP, './video/other.mp4', base)).toBeNull();
    expect(packageHlsUrl(MAP, '#', base)).toBeNull();
  });

  it('attaches hls.js inside the frame and routes the package’s own load() calls through the map', () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.open(); doc.write('<!doctype html><html><head><base href="https://timeless.uz/contents/B/05/B0502/001/04/index.html"></head><body><video id="video1"><source id="vSource" src="./video/lect.mp4" type="video/mp4"></video></body></html>'); doc.close();
    const loaded: string[] = [];
    class FakeHls { static isSupported() { return true; } loadSource(u: string) { loaded.push(u); } attachMedia() { /* noop */ } destroy() { /* noop */ } }
    (iframe.contentWindow as unknown as { Hls: unknown }).Hls = FakeHls;
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    attachPackageHls(iframe, MAP);
    expect(loaded).toEqual([MAP['/contents/B/05/B0502/001/04/video/lect.mp4']]);
    const v = doc.getElementById('video1') as HTMLVideoElement;
    doc.getElementById('vSource')!.setAttribute('src', './video/other.mp4');
    v.load(); // not mapped → native MP4 load
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalled();
    doc.getElementById('vSource')!.setAttribute('src', './video/lect.mp4');
    v.load(); // mapped again → HLS
    expect(loaded).toHaveLength(2);
    attachPackageHls(null, MAP); attachPackageHls(iframe, null); // no-ops
  });
});
