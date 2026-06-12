// File: mobile/src/icons.ts
/**
 * Tree-shaken Lucide icons — import from the package root.
 *
 * WHY: "lucide-react-native" v1.16.0 exposes every icon as a named ESM export
 * from its root entry (dist/esm/lucide-react-native.mjs, also mapped via the
 * "react-native" field). This lets Metro bundle only the icons we actually use.
 * Deep subpaths like dist/cjs/icons/<name> are NOT in the package "exports"
 * map and cause Metro resolution warnings.
 */
export {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Award,
  Bell,
  Briefcase,
  Camera,
  CheckCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Edit2,
  Filter,
  Flame,
  Gift,
  HelpCircle,
  Home,
  Info,
  LayoutDashboard,
  List,
  LogOut,
  MapIcon,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Send,
  Settings,
  Share2,
  Shield,
  Star,
  Trash2,
  TrendingUp,
  Trophy,
  User,
  Users,
  Wallet,
  Wrench,
  X,
  XCircle,
  DollarSign,
  Timer,
  RefreshCw,
  Languages,
  Wifi,
  WifiOff,
  Zap,
  // Sprint 10 — Skill Videos
  PlayCircle,
  Eye,
  Video,
  Upload,
} from 'lucide-react-native';
