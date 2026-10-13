import type { SVGProps } from 'react';
import {
  ArrowLeft, ArrowRight, ArrowUpDown, ArrowUpRight, Award, Bell, BookOpen, Bot, Brain, Briefcase, Building2, Calendar, ChartColumn, Check,
  ChevronDown, ChevronRight, ChevronUp, CircleCheck, Clock, Compass, ExternalLink, Eye, FileText, Flag, Funnel, Gauge, GraduationCap, Headset,
  Heart, Info, Layers, LayoutGrid, Library, Lightbulb, ListChecks, LoaderCircle, Lock, Mail, Megaphone, Menu, MessageCircle, Minus,
  MonitorPlay, Phone, Play, Plus, Radio, Route, Search, ShieldCheck, SlidersHorizontal, Smartphone, Sparkle, Sparkles, Star, Target,
  TrendingUp, TriangleAlert, User, Users, Video, WandSparkles, X, Zap, type LucideIcon,
} from 'lucide-react';

/**
 * One icon family (Lucide, 24 px grid, round caps). Components refer to icons by these semantic names only, so the
 * underlying set can change in one place. Colour comes from `currentColor`; use IconTile for tinted containers.
 */
const ICONS = {
  search: Search, menu: Menu, close: X, arrow: ArrowRight, 'arrow-left': ArrowLeft, 'arrow-up-right': ArrowUpRight,
  'chevron-down': ChevronDown, 'chevron-right': ChevronRight, 'chevron-up': ChevronUp, external: ExternalLink,
  play: Play, heart: Heart, star: Star, check: Check, 'check-circle': CircleCheck, user: User, users: Users,
  briefcase: Briefcase, flag: Flag, spark: Sparkle, info: Info, alert: TriangleAlert, lock: Lock, clock: Clock,
  file: FileText, calendar: Calendar, phone: Phone, plus: Plus, minus: Minus, filter: Funnel, sliders: SlidersHorizontal,
  sort: ArrowUpDown, video: Video, bolt: Zap, shorts: Smartphone, sparkles: Sparkles, broadcast: Radio, gauge: Gauge,
  mail: Mail, graduation: GraduationCap, route: Route, compass: Compass, layers: Layers, trending: TrendingUp, eye: Eye,
  book: BookOpen, target: Target, brain: Brain, chart: ChartColumn, megaphone: Megaphone, bell: Bell, loader: LoaderCircle,
  monitor: MonitorPlay, building: Building2, headset: Headset, message: MessageCircle, lightbulb: Lightbulb,
  shield: ShieldCheck, award: Award, checklist: ListChecks, grid: LayoutGrid, library: Library, bot: Bot, wand: WandSparkles,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> { name: IconName; size?: number; title?: string; strokeWidth?: number }

/** Line icon (1.75 px stroke at 24 px, round caps). Decorative unless `title` is provided. `play` renders filled. */
export function Icon({ name, size = 20, title, strokeWidth = 1.75, ...rest }: IconProps) {
  const Cmp = ICONS[name];
  return (
    <Cmp
      size={size}
      strokeWidth={strokeWidth}
      absoluteStrokeWidth={false}
      fill={name === 'play' ? 'currentColor' : 'none'}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title}
      focusable="false"
      {...rest}
    />
  );
}
