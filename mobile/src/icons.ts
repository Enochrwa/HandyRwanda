// File: mobile/src/icons.ts
/**
 * Tree-shaken Lucide icons — import from here, not from "lucide-react-native".
 *
 * WHY: lucide-react-native v1.x ships ~1,500 icon modules. Importing from the
 * package root pulls the full bundle and causes Metro to stall near 100%.
 * We instead import individual CJS files (dist/cjs/icons/<name>.js), which
 * Metro can resolve without walking the entire icon tree.
 *
 * NOTE: package.json has "type": "commonjs", so Metro prefers .js (CJS) over
 * .mjs (ESM). The CJS files each do `module.exports = IconComponent`, which
 * is compatible with the default-import syntax used here.
 */
export { default as AlertCircle } from 'lucide-react-native/dist/cjs/icons/circle-alert';
export { default as AlertTriangle } from 'lucide-react-native/dist/cjs/icons/triangle-alert';
export { default as ArrowRight } from 'lucide-react-native/dist/cjs/icons/arrow-right';
export { default as Award } from 'lucide-react-native/dist/cjs/icons/award';
export { default as Bell } from 'lucide-react-native/dist/cjs/icons/bell';
export { default as Briefcase } from 'lucide-react-native/dist/cjs/icons/briefcase';
export { default as Camera } from 'lucide-react-native/dist/cjs/icons/camera';
export { default as CheckCircle } from 'lucide-react-native/dist/cjs/icons/circle-check';
export { default as CheckCircle2 } from 'lucide-react-native/dist/cjs/icons/circle-check-big';
export { default as ChevronLeft } from 'lucide-react-native/dist/cjs/icons/chevron-left';
export { default as ChevronRight } from 'lucide-react-native/dist/cjs/icons/chevron-right';
export { default as Clock } from 'lucide-react-native/dist/cjs/icons/clock';
export { default as Edit2 } from 'lucide-react-native/dist/cjs/icons/pencil';
export { default as Filter } from 'lucide-react-native/dist/cjs/icons/list-filter';
export { default as Flame } from 'lucide-react-native/dist/cjs/icons/flame';
export { default as HelpCircle } from 'lucide-react-native/dist/cjs/icons/circle-question-mark';
export { default as Home } from 'lucide-react-native/dist/cjs/icons/house';
export { default as LayoutDashboard } from 'lucide-react-native/dist/cjs/icons/layout-dashboard';
export { default as List } from 'lucide-react-native/dist/cjs/icons/list';
export { default as LogOut } from 'lucide-react-native/dist/cjs/icons/log-out';
export { default as MapIcon } from 'lucide-react-native/dist/cjs/icons/map';
export { default as MapPin } from 'lucide-react-native/dist/cjs/icons/map-pin';
export { default as MessageCircle } from 'lucide-react-native/dist/cjs/icons/message-circle';
export { default as Phone } from 'lucide-react-native/dist/cjs/icons/phone';
export { default as Plus } from 'lucide-react-native/dist/cjs/icons/plus';
export { default as Search } from 'lucide-react-native/dist/cjs/icons/search';
export { default as Send } from 'lucide-react-native/dist/cjs/icons/send';
export { default as Settings } from 'lucide-react-native/dist/cjs/icons/settings';
export { default as Shield } from 'lucide-react-native/dist/cjs/icons/shield';
export { default as Star } from 'lucide-react-native/dist/cjs/icons/star';
export { default as Trash2 } from 'lucide-react-native/dist/cjs/icons/trash-2';
export { default as TrendingUp } from 'lucide-react-native/dist/cjs/icons/trending-up';
export { default as Trophy } from 'lucide-react-native/dist/cjs/icons/trophy';
export { default as User } from 'lucide-react-native/dist/cjs/icons/user';
export { default as Wallet } from 'lucide-react-native/dist/cjs/icons/wallet';
export { default as Wrench } from 'lucide-react-native/dist/cjs/icons/wrench';
export { default as X } from 'lucide-react-native/dist/cjs/icons/x';
export { default as Zap } from 'lucide-react-native/dist/cjs/icons/zap';
