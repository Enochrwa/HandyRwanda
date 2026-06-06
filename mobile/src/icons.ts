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
  Edit2,
  Filter,
  Flame,
  HelpCircle,
  Home,
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
  Shield,
  Star,
  Trash2,
  TrendingUp,
  Trophy,
  User,
  Wallet,
  Wrench,
  X,
  Zap,
} from 'lucide-react-native';
