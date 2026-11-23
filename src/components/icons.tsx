// Punto único de iconos: toda la app importa desde aquí, nunca de una
// librería directamente. Los nombres exportados conservan los nombres que el
// código usaba con lucide-react (alias a los componentes de Phosphor).
// Se usa el entry `dist/ssr` porque no depende de React context y funciona
// igual en Server y en Client Components.

export type { Icon as LucideIcon } from "@phosphor-icons/react";
export {
  ArrowCircleDownIcon as CircleArrowDown,
  ArrowCircleUpIcon as CircleArrowUp,
  ArrowCounterClockwiseIcon as RotateCcw,
  ArrowDownIcon,
  ArrowLeftIcon as ArrowLeft,
  ArrowRightIcon as ArrowRight,
  ArrowsClockwiseIcon as RefreshCw,
  ArrowsDownUpIcon as ArrowUpDownIcon,
  ArrowsLeftRightIcon as ArrowLeftRight,
  ArrowsLeftRightIcon as ArrowRightLeft,
  ArrowsOutIcon as Expand,
  ArrowUpIcon,
  ArrowUpRightIcon as ArrowUpRight,
  ArrowUUpLeftIcon as Undo2,
  BackspaceIcon as Delete,
  BankIcon as Bank,
  BankIcon as Landmark,
  BarcodeIcon as Barcode,
  BarcodeIcon as ScanBarcode,
  BasketIcon as Basket,
  BookOpenIcon as BookOpen,
  BriefcaseIcon as Briefcase,
  BuildingsIcon as Building2,
  CalculatorIcon as Calculator,
  CalendarDotsIcon as CalendarClock,
  CalendarDotsIcon as CalendarDays,
  CalendarIcon as Calendar,
  CalendarPlusIcon as CalendarPlus,
  CaretDoubleLeftIcon as ChevronsLeft,
  CaretDoubleRightIcon as ChevronsRight,
  CaretDownIcon as ChevronDown,
  CaretDownIcon as ChevronDownIcon,
  CaretLeftIcon as ChevronLeft,
  CaretLeftIcon as ChevronLeftIcon,
  CaretRightIcon as ChevronRight,
  CaretRightIcon as ChevronRightIcon,
  CaretUpIcon as ChevronUpIcon,
  ChartBarIcon as FileBarChart,
  ChartLineIcon as ChartLine,
  ChartPieIcon as ChartPie,
  CheckCircleIcon as CheckCircle2,
  CheckCircleIcon as CircleCheck,
  CheckCircleIcon as CircleCheckIcon,
  CheckIcon as Check,
  CheckIcon,
  CheckSquareIcon as CheckSquare,
  CircleNotchIcon as Loader2,
  CircleNotchIcon as Loader2Icon,
  CircleNotchIcon as LoaderCircleIcon,
  ClipboardTextIcon as ClipboardList,
  ClipboardTextIcon as ClipboardPen,
  ClockCounterClockwiseIcon as History,
  ClockIcon as Clock,
  CoinsIcon as Coins,
  ColumnsIcon as Columns3Icon,
  CompassIcon as Compass,
  CopyIcon as Copy,
  CopyIcon,
  CreditCardIcon as CreditCard,
  CurrencyCircleDollarIcon as CircleDollarSign,
  DatabaseIcon as DatabaseZap,
  DotsThreeIcon as MoreHorizontal,
  DotsThreeIcon as MoreHorizontalIcon,
  DotsThreeVerticalIcon as EllipsisVertical,
  DotsThreeVerticalIcon as MoreVertical,
  DownloadSimpleIcon as Download,
  EnvelopeIcon as Mail,
  EyeIcon as Eye,
  FileIcon as File,
  FileMinusIcon as FileMinus,
  FileMinusIcon as FileMinus2,
  FilePlusIcon as FilePlus,
  FilePlusIcon as FilePlus2,
  FilesIcon as FileStack,
  FileTextIcon as FileText,
  FileXlsIcon as FileSpreadsheet,
  FolderOpenIcon as FolderOpen,
  FunnelSimpleIcon as ListFilter,
  GearIcon as Gear,
  GearIcon as Settings,
  GitForkIcon as Split,
  HandCoinsIcon as HandCoins,
  HashIcon as Hash,
  HouseIcon as House,
  IdentificationCardIcon as IdentificationCard,
  ImageIcon as ImagePlus,
  InfoIcon as Info,
  InfoIcon,
  LightningIcon as Zap,
  ListIcon as Menu,
  ListNumbersIcon as ListOrdered,
  LockIcon as Lock,
  MagnifyingGlassIcon as Search,
  MagnifyingGlassIcon as SearchIcon,
  MapPinIcon as MapPin,
  MinusIcon as Minus,
  MinusIcon,
  MoneyIcon as Banknote,
  MonitorIcon as Monitor,
  MonitorIcon as MonitorCog,
  MoonIcon as Moon,
  NotebookIcon as NotebookText,
  NotePencilIcon as SquarePen,
  PackageIcon as Boxes,
  PackageIcon as Package,
  PackageIcon as PackageCheck,
  PackageIcon as PackagePlus,
  PackageIcon as PackageSearch,
  PackageIcon as PackageX,
  PaperclipIcon as Paperclip,
  PaperPlaneTiltIcon as Send,
  PauseCircleIcon as PauseCircle,
  PencilSimpleIcon as Pencil,
  PercentIcon as Percent,
  PhoneIcon as Phone,
  PlayIcon as Play,
  PlusCircleIcon as CirclePlusIcon,
  PlusIcon as Plus,
  PrinterIcon as Printer,
  ProhibitIcon as Ban,
  ProhibitIcon as CircleSlash,
  PushPinIcon as Pin,
  PushPinSlashIcon as PinOff,
  ReceiptIcon as Receipt,
  ReceiptIcon as ReceiptText,
  RepeatIcon as Repeat,
  RulerIcon as Ruler,
  ScalesIcon as Scale,
  ShareNetworkIcon as Share2,
  ShieldCheckIcon as ShieldCheck,
  ShieldWarningIcon as ShieldAlert,
  ShoppingBagIcon as ShoppingBag,
  ShoppingCartIcon as ShoppingCart,
  SidebarSimpleIcon as PanelLeftIcon,
  SignOutIcon as LogOut,
  SlidersHorizontalIcon as SlidersHorizontal,
  SparkleIcon as Sparkles,
  SquaresFourIcon as LayoutGrid,
  StackIcon as Layers,
  StarIcon as Star,
  StorefrontIcon as Store,
  StorefrontIcon as Storefront,
  SunIcon as Sun,
  TagIcon as Tag,
  TagIcon as Tags,
  ThumbsDownIcon as ThumbsDown,
  ThumbsUpIcon as ThumbsUp,
  TrashIcon as Trash2,
  TrayIcon as Inbox,
  TreeStructureIcon as ListTree,
  TrendDownIcon as TrendingDown,
  TrendUpIcon as TrendingUp,
  TruckIcon as Truck,
  UploadSimpleIcon as Upload,
  UserIcon as UserRound,
  UserMinusIcon as UserX,
  UserPlusIcon as UserPlus,
  UsersIcon as Users,
  UsersIcon as UsersRound,
  WalletIcon as Wallet,
  WarehouseIcon as Warehouse,
  WarningCircleIcon as CircleAlert,
  WarningIcon as AlertTriangle,
  WarningIcon as TriangleAlert,
  WarningIcon as TriangleAlertIcon,
  WarningOctagonIcon as OctagonAlert,
  WrenchIcon as Wrench,
  XCircleIcon as OctagonXIcon,
  XIcon as X,
  XIcon,
} from "@phosphor-icons/react/dist/ssr";

// Iconos de HugeIcons (estilo stroke fino, como los de Alegra) — decisión de
// Waldy: se usan en las pantallas que copian su diseño. Se envuelven con el
// mismo contrato que los de Phosphor (className/style, strokeWidth 1.5).

import {
  Analytics01Icon,
  BankIcon,
  BookOpen01Icon,
  Briefcase01Icon,
  Cash02Icon,
  ChartColumnIcon,
  CheckmarkSquare02Icon,
  DollarCircleIcon,
  File01Icon,
  Home01Icon,
  IdCardIcon,
  InboxIcon,
  Invoice01Icon,
  PackageIcon,
  ReceiptDollarIcon,
  ReceiptIcon,
  Settings02Icon,
  ShoppingCart01Icon,
  Star as StarIconHuge,
  Store01Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type HugeiconsIconProps } from "@hugeicons/react";

export type { IconSvgElement } from "@hugeicons/react";
export type PropsIconoHuge = Omit<HugeiconsIconProps, "icon">;
export type IconoHuge = (props: PropsIconoHuge) => import("react").ReactElement;

// Categorías de la página de Reportes (mismo glifo que Alegra).
export function HugeDollarCircle(props: PropsIconoHuge) {
  return <HugeiconsIcon icon={DollarCircleIcon} strokeWidth={1.5} {...props} />;
}
export function HugeChartColumn(props: PropsIconoHuge) {
  return <HugeiconsIcon icon={ChartColumnIcon} strokeWidth={1.5} {...props} />;
}
export function HugeCash(props: PropsIconoHuge) {
  return <HugeiconsIcon icon={Cash02Icon} strokeWidth={1.5} {...props} />;
}
export function HugeInvoice(props: PropsIconoHuge) {
  return <HugeiconsIcon icon={Invoice01Icon} strokeWidth={1.5} {...props} />;
}
export function HugeReceiptDollar(props: PropsIconoHuge) {
  return <HugeiconsIcon icon={ReceiptDollarIcon} strokeWidth={1.5} {...props} />;
}
export function HugeBriefcase(props: PropsIconoHuge) {
  return <HugeiconsIcon icon={Briefcase01Icon} strokeWidth={1.5} {...props} />;
}
export function HugeStar(props: PropsIconoHuge) {
  return <HugeiconsIcon icon={StarIconHuge} strokeWidth={1.5} {...props} />;
}

// Menú lateral (orden de Alegra).
export function HugeHome(props: PropsIconoHuge) {
  return <HugeiconsIcon icon={Home01Icon} strokeWidth={1.5} {...props} />;
}
export function HugeInbox(props: PropsIconoHuge) {
  return <HugeiconsIcon icon={InboxIcon} strokeWidth={1.5} {...props} />;
}
export function HugeReceipt(props: PropsIconoHuge) {
  return <HugeiconsIcon icon={ReceiptIcon} strokeWidth={1.5} {...props} />;
}
export function HugeShoppingCart(props: PropsIconoHuge) {
  return <HugeiconsIcon icon={ShoppingCart01Icon} strokeWidth={1.5} {...props} />;
}
export function HugeUsers(props: PropsIconoHuge) {
  return <HugeiconsIcon icon={UserMultiple02Icon} strokeWidth={1.5} {...props} />;
}
export function HugePackage(props: PropsIconoHuge) {
  return <HugeiconsIcon icon={PackageIcon} strokeWidth={1.5} {...props} />;
}
export function HugeBank(props: PropsIconoHuge) {
  return <HugeiconsIcon icon={BankIcon} strokeWidth={1.5} {...props} />;
}
export function HugeBookOpen(props: PropsIconoHuge) {
  return <HugeiconsIcon icon={BookOpen01Icon} strokeWidth={1.5} {...props} />;
}
export function HugeAnalytics(props: PropsIconoHuge) {
  return <HugeiconsIcon icon={Analytics01Icon} strokeWidth={1.5} {...props} />;
}
export function HugeCheckSquare(props: PropsIconoHuge) {
  return <HugeiconsIcon icon={CheckmarkSquare02Icon} strokeWidth={1.5} {...props} />;
}
export function HugeSettings(props: PropsIconoHuge) {
  return <HugeiconsIcon icon={Settings02Icon} strokeWidth={1.5} {...props} />;
}
export function HugeFile(props: PropsIconoHuge) {
  return <HugeiconsIcon icon={File01Icon} strokeWidth={1.5} {...props} />;
}
export function HugeIdCard(props: PropsIconoHuge) {
  return <HugeiconsIcon icon={IdCardIcon} strokeWidth={1.5} {...props} />;
}
export function HugeStore(props: PropsIconoHuge) {
  return <HugeiconsIcon icon={Store01Icon} strokeWidth={1.5} {...props} />;
}
