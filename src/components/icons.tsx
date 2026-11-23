// Punto único de iconos: toda la app importa desde aquí, nunca de una
// librería directamente (decisión de Waldy, nov-2026).
// Librería principal: **Tabler Icons** (@tabler/icons-react) — la misma que usa
// Alegra en su HTML (tabler-icon-*), stroke 1.5 como ellos lo renderizan.
// Los nombres exportados conservan los alias estilo lucide que el código ya usaba.

import {
  IconAdjustmentsHorizontal,
  IconAlertCircle,
  IconAlertOctagon,
  IconAlertTriangle,
  IconArrowBackUp,
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconArrowsLeftRight,
  IconArrowsMaximize,
  IconArrowsUpDown,
  IconArrowUp,
  IconArrowUpRight,
  IconBackspace,
  IconBan,
  IconBarcode,
  IconBasket,
  IconBinaryTree,
  IconBolt,
  IconBook,
  IconBriefcase,
  IconBuilding,
  IconBuildingBank,
  IconBuildingStore,
  IconBuildingWarehouse,
  IconCalculator,
  IconCalendar,
  IconCalendarPlus,
  IconCaretDownFilled,
  IconCaretLeftFilled,
  IconCaretRightFilled,
  IconCaretUpFilled,
  IconCash,
  IconCashRegister,
  IconChartBar,
  IconChartBarPopular,
  IconChartLine,
  IconChartPie,
  IconCheck,
  IconChevronsLeft,
  IconChevronsRight,
  IconCircleArrowDown,
  IconCircleArrowDownLeft,
  IconCircleArrowUp,
  IconCircleArrowUpRight,
  IconCircleCheck,
  IconCirclePlus,
  IconCircleX,
  IconClipboardCheck,
  IconClipboardText,
  IconClock,
  IconCoin,
  IconCoins,
  IconColumns,
  IconCompass,
  IconCopy,
  IconCreditCard,
  IconDatabase,
  IconDeviceDesktop,
  IconDots,
  IconDotsVertical,
  IconDownload,
  IconEye,
  IconFile,
  IconFileInvoice,
  IconFileMinus,
  IconFilePlus,
  IconFileSpreadsheet,
  IconFiles,
  IconFileText,
  IconFilter,
  IconFolderOpen,
  IconGitFork,
  IconHash,
  IconHistory,
  IconHome,
  IconIdBadge,
  IconIdBadge2,
  IconInbox,
  IconInfoCircle,
  IconLayersSubtract,
  IconLayoutGrid,
  IconLayoutSidebar,
  IconList,
  IconListNumbers,
  IconLoader2,
  IconLock,
  IconLogout,
  IconMail,
  IconMapPin,
  IconMinus,
  IconMoon,
  IconNote,
  IconNotebook,
  IconPackage,
  IconPaperclip,
  IconPencil,
  IconPercentage,
  IconPhone,
  IconPhoto,
  IconPin,
  IconPinnedOff,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlus,
  IconPrinter,
  IconReceipt,
  IconRefresh,
  IconRepeat,
  IconReportMoney,
  IconRestore,
  IconRuler,
  IconScale,
  IconSearch,
  IconSend,
  IconSettings,
  IconShare2,
  IconShieldCheck,
  IconShieldExclamation,
  IconShoppingBag,
  IconShoppingCart,
  IconSparkles,
  IconSquareCheck,
  IconStar,
  IconSun,
  IconTag,
  IconThumbDown,
  IconThumbUp,
  IconTimeline,
  IconTool,
  IconTrash,
  IconTrendingDown,
  IconTrendingUp,
  IconTruck,
  IconUpload,
  IconUser,
  IconUserMinus,
  IconUserPlus,
  IconUsers,
  IconWallet,
  IconX,
  type IconProps as TablerIconProps,
} from "@tabler/icons-react";

export type PropsIcono = Omit<TablerIconProps, "ref">;
/** Componente de icono de la app (Tabler); acepta className, size, style, stroke. */
export type Icono = (props: PropsIcono) => import("react").ReactElement;
export type IconoTabler = Icono;
/** @deprecated usar Icono; se conserva el nombre histórico del barrel. */
export type LucideIcon = Icono;

export function AlertTriangle(props: PropsIcono) {
  return <IconAlertTriangle stroke={1.5} {...props} />;
}

export function ArrowDownIcon(props: PropsIcono) {
  return <IconArrowDown stroke={1.5} {...props} />;
}

export function ArrowLeft(props: PropsIcono) {
  return <IconArrowLeft stroke={1.5} {...props} />;
}

export function ArrowLeftRight(props: PropsIcono) {
  return <IconArrowsLeftRight stroke={1.5} {...props} />;
}

export function ArrowRight(props: PropsIcono) {
  return <IconArrowRight stroke={1.5} {...props} />;
}

export function ArrowRightLeft(props: PropsIcono) {
  return <IconArrowsLeftRight stroke={1.5} {...props} />;
}

export function ArrowUpDownIcon(props: PropsIcono) {
  return <IconArrowsUpDown stroke={1.5} {...props} />;
}

export function ArrowUpIcon(props: PropsIcono) {
  return <IconArrowUp stroke={1.5} {...props} />;
}

export function ArrowUpRight(props: PropsIcono) {
  return <IconArrowUpRight stroke={1.5} {...props} />;
}

export function Ban(props: PropsIcono) {
  return <IconBan stroke={1.5} {...props} />;
}

export function Bank(props: PropsIcono) {
  return <IconBuildingBank stroke={1.5} {...props} />;
}

export function Banknote(props: PropsIcono) {
  return <IconCash stroke={1.5} {...props} />;
}

export function Barcode(props: PropsIcono) {
  return <IconBarcode stroke={1.5} {...props} />;
}

export function Basket(props: PropsIcono) {
  return <IconBasket stroke={1.5} {...props} />;
}

export function BookOpen(props: PropsIcono) {
  return <IconBook stroke={1.5} {...props} />;
}

export function Boxes(props: PropsIcono) {
  return <IconPackage stroke={1.5} {...props} />;
}

export function Briefcase(props: PropsIcono) {
  return <IconBriefcase stroke={1.5} {...props} />;
}

export function Building2(props: PropsIcono) {
  return <IconBuilding stroke={1.5} {...props} />;
}

export function Calculator(props: PropsIcono) {
  return <IconCalculator stroke={1.5} {...props} />;
}

export function Calendar(props: PropsIcono) {
  return <IconCalendar stroke={1.5} {...props} />;
}

export function CalendarClock(props: PropsIcono) {
  return <IconCalendar stroke={1.5} {...props} />;
}

export function CalendarDays(props: PropsIcono) {
  return <IconCalendar stroke={1.5} {...props} />;
}

export function CalendarPlus(props: PropsIcono) {
  return <IconCalendarPlus stroke={1.5} {...props} />;
}

export function ChartLine(props: PropsIcono) {
  return <IconChartLine stroke={1.5} {...props} />;
}

export function ChartPie(props: PropsIcono) {
  return <IconChartPie stroke={1.5} {...props} />;
}

export function Check(props: PropsIcono) {
  return <IconCheck stroke={1.5} {...props} />;
}

export function CheckCircle2(props: PropsIcono) {
  return <IconCircleCheck stroke={1.5} {...props} />;
}

export function CheckIcon(props: PropsIcono) {
  return <IconCheck stroke={1.5} {...props} />;
}

export function CheckSquare(props: PropsIcono) {
  return <IconSquareCheck stroke={1.5} {...props} />;
}

export function ChevronDown(props: PropsIcono) {
  return <IconCaretDownFilled stroke={1.5} {...props} />;
}

export function ChevronDownIcon(props: PropsIcono) {
  return <IconCaretDownFilled stroke={1.5} {...props} />;
}

export function ChevronLeft(props: PropsIcono) {
  return <IconCaretLeftFilled stroke={1.5} {...props} />;
}

export function ChevronLeftIcon(props: PropsIcono) {
  return <IconCaretLeftFilled stroke={1.5} {...props} />;
}

export function ChevronRight(props: PropsIcono) {
  return <IconCaretRightFilled stroke={1.5} {...props} />;
}

export function ChevronRightIcon(props: PropsIcono) {
  return <IconCaretRightFilled stroke={1.5} {...props} />;
}

export function ChevronUpIcon(props: PropsIcono) {
  return <IconCaretUpFilled stroke={1.5} {...props} />;
}

export function ChevronsLeft(props: PropsIcono) {
  return <IconChevronsLeft stroke={1.5} {...props} />;
}

export function ChevronsRight(props: PropsIcono) {
  return <IconChevronsRight stroke={1.5} {...props} />;
}

export function CircleAlert(props: PropsIcono) {
  return <IconAlertCircle stroke={1.5} {...props} />;
}

export function CircleArrowDown(props: PropsIcono) {
  return <IconCircleArrowDown stroke={1.5} {...props} />;
}

export function CircleArrowUp(props: PropsIcono) {
  return <IconCircleArrowUp stroke={1.5} {...props} />;
}

export function CircleCheck(props: PropsIcono) {
  return <IconCircleCheck stroke={1.5} {...props} />;
}

export function CircleCheckIcon(props: PropsIcono) {
  return <IconCircleCheck stroke={1.5} {...props} />;
}

export function CircleDollarSign(props: PropsIcono) {
  return <IconCoin stroke={1.5} {...props} />;
}

export function CirclePlusIcon(props: PropsIcono) {
  return <IconCirclePlus stroke={1.5} {...props} />;
}

export function CircleSlash(props: PropsIcono) {
  return <IconBan stroke={1.5} {...props} />;
}

export function ClipboardList(props: PropsIcono) {
  return <IconClipboardText stroke={1.5} {...props} />;
}

export function ClipboardPen(props: PropsIcono) {
  return <IconClipboardText stroke={1.5} {...props} />;
}

export function Clock(props: PropsIcono) {
  return <IconClock stroke={1.5} {...props} />;
}

export function Coins(props: PropsIcono) {
  return <IconCoins stroke={1.5} {...props} />;
}

export function Columns3Icon(props: PropsIcono) {
  return <IconColumns stroke={1.5} {...props} />;
}

export function Compass(props: PropsIcono) {
  return <IconCompass stroke={1.5} {...props} />;
}

export function Copy(props: PropsIcono) {
  return <IconCopy stroke={1.5} {...props} />;
}

export function CopyIcon(props: PropsIcono) {
  return <IconCopy stroke={1.5} {...props} />;
}

export function CreditCard(props: PropsIcono) {
  return <IconCreditCard stroke={1.5} {...props} />;
}

export function DatabaseZap(props: PropsIcono) {
  return <IconDatabase stroke={1.5} {...props} />;
}

export function Delete(props: PropsIcono) {
  return <IconBackspace stroke={1.5} {...props} />;
}

export function Download(props: PropsIcono) {
  return <IconDownload stroke={1.5} {...props} />;
}

export function EllipsisVertical(props: PropsIcono) {
  return <IconDotsVertical stroke={1.5} {...props} />;
}

export function Expand(props: PropsIcono) {
  return <IconArrowsMaximize stroke={1.5} {...props} />;
}

export function Eye(props: PropsIcono) {
  return <IconEye stroke={1.5} {...props} />;
}

export function File(props: PropsIcono) {
  return <IconFile stroke={1.5} {...props} />;
}

export function FileBarChart(props: PropsIcono) {
  return <IconChartBar stroke={1.5} {...props} />;
}

export function FileMinus(props: PropsIcono) {
  return <IconFileMinus stroke={1.5} {...props} />;
}

export function FileMinus2(props: PropsIcono) {
  return <IconFileMinus stroke={1.5} {...props} />;
}

export function FilePlus(props: PropsIcono) {
  return <IconFilePlus stroke={1.5} {...props} />;
}

export function FilePlus2(props: PropsIcono) {
  return <IconFilePlus stroke={1.5} {...props} />;
}

export function FileSpreadsheet(props: PropsIcono) {
  return <IconFileSpreadsheet stroke={1.5} {...props} />;
}

export function FileStack(props: PropsIcono) {
  return <IconFiles stroke={1.5} {...props} />;
}

export function FileText(props: PropsIcono) {
  return <IconFileText stroke={1.5} {...props} />;
}

export function FolderOpen(props: PropsIcono) {
  return <IconFolderOpen stroke={1.5} {...props} />;
}

export function Gear(props: PropsIcono) {
  return <IconSettings stroke={1.5} {...props} />;
}

export function HandCoins(props: PropsIcono) {
  return <IconCoin stroke={1.5} {...props} />;
}

export function Hash(props: PropsIcono) {
  return <IconHash stroke={1.5} {...props} />;
}

export function History(props: PropsIcono) {
  return <IconHistory stroke={1.5} {...props} />;
}

export function House(props: PropsIcono) {
  return <IconHome stroke={1.5} {...props} />;
}

export function IdentificationCard(props: PropsIcono) {
  return <IconIdBadge stroke={1.5} {...props} />;
}

export function ImagePlus(props: PropsIcono) {
  return <IconPhoto stroke={1.5} {...props} />;
}

export function Inbox(props: PropsIcono) {
  return <IconInbox stroke={1.5} {...props} />;
}

export function Info(props: PropsIcono) {
  return <IconInfoCircle stroke={1.5} {...props} />;
}

export function InfoIcon(props: PropsIcono) {
  return <IconInfoCircle stroke={1.5} {...props} />;
}

export function Landmark(props: PropsIcono) {
  return <IconBuildingBank stroke={1.5} {...props} />;
}

export function Layers(props: PropsIcono) {
  return <IconLayersSubtract stroke={1.5} {...props} />;
}

export function LayoutGrid(props: PropsIcono) {
  return <IconLayoutGrid stroke={1.5} {...props} />;
}

export function ListFilter(props: PropsIcono) {
  return <IconFilter stroke={1.5} {...props} />;
}

export function ListOrdered(props: PropsIcono) {
  return <IconListNumbers stroke={1.5} {...props} />;
}

export function ListTree(props: PropsIcono) {
  return <IconBinaryTree stroke={1.5} {...props} />;
}

export function Loader2(props: PropsIcono) {
  return <IconLoader2 stroke={1.5} {...props} />;
}

export function Loader2Icon(props: PropsIcono) {
  return <IconLoader2 stroke={1.5} {...props} />;
}

export function LoaderCircleIcon(props: PropsIcono) {
  return <IconLoader2 stroke={1.5} {...props} />;
}

export function Lock(props: PropsIcono) {
  return <IconLock stroke={1.5} {...props} />;
}

export function LogOut(props: PropsIcono) {
  return <IconLogout stroke={1.5} {...props} />;
}

export function Mail(props: PropsIcono) {
  return <IconMail stroke={1.5} {...props} />;
}

export function MapPin(props: PropsIcono) {
  return <IconMapPin stroke={1.5} {...props} />;
}

export function Menu(props: PropsIcono) {
  return <IconList stroke={1.5} {...props} />;
}

export function Minus(props: PropsIcono) {
  return <IconMinus stroke={1.5} {...props} />;
}

export function MinusIcon(props: PropsIcono) {
  return <IconMinus stroke={1.5} {...props} />;
}

export function Monitor(props: PropsIcono) {
  return <IconDeviceDesktop stroke={1.5} {...props} />;
}

export function MonitorCog(props: PropsIcono) {
  return <IconDeviceDesktop stroke={1.5} {...props} />;
}

export function Moon(props: PropsIcono) {
  return <IconMoon stroke={1.5} {...props} />;
}

export function MoreHorizontal(props: PropsIcono) {
  return <IconDots stroke={1.5} {...props} />;
}

export function MoreHorizontalIcon(props: PropsIcono) {
  return <IconDots stroke={1.5} {...props} />;
}

export function MoreVertical(props: PropsIcono) {
  return <IconDotsVertical stroke={1.5} {...props} />;
}

export function NotebookText(props: PropsIcono) {
  return <IconNotebook stroke={1.5} {...props} />;
}

export function OctagonAlert(props: PropsIcono) {
  return <IconAlertOctagon stroke={1.5} {...props} />;
}

export function OctagonXIcon(props: PropsIcono) {
  return <IconCircleX stroke={1.5} {...props} />;
}

export function Package(props: PropsIcono) {
  return <IconPackage stroke={1.5} {...props} />;
}

export function PackageCheck(props: PropsIcono) {
  return <IconPackage stroke={1.5} {...props} />;
}

export function PackagePlus(props: PropsIcono) {
  return <IconPackage stroke={1.5} {...props} />;
}

export function PackageSearch(props: PropsIcono) {
  return <IconPackage stroke={1.5} {...props} />;
}

export function PackageX(props: PropsIcono) {
  return <IconPackage stroke={1.5} {...props} />;
}

export function PanelLeftIcon(props: PropsIcono) {
  return <IconLayoutSidebar stroke={1.5} {...props} />;
}

export function Paperclip(props: PropsIcono) {
  return <IconPaperclip stroke={1.5} {...props} />;
}

export function PauseCircle(props: PropsIcono) {
  return <IconPlayerPause stroke={1.5} {...props} />;
}

export function Pencil(props: PropsIcono) {
  return <IconPencil stroke={1.5} {...props} />;
}

export function Percent(props: PropsIcono) {
  return <IconPercentage stroke={1.5} {...props} />;
}

export function Phone(props: PropsIcono) {
  return <IconPhone stroke={1.5} {...props} />;
}

export function Pin(props: PropsIcono) {
  return <IconPin stroke={1.5} {...props} />;
}

export function PinOff(props: PropsIcono) {
  return <IconPinnedOff stroke={1.5} {...props} />;
}

export function Play(props: PropsIcono) {
  return <IconPlayerPlay stroke={1.5} {...props} />;
}

export function Plus(props: PropsIcono) {
  return <IconPlus stroke={1.5} {...props} />;
}

export function Printer(props: PropsIcono) {
  return <IconPrinter stroke={1.5} {...props} />;
}

export function Receipt(props: PropsIcono) {
  return <IconReceipt stroke={1.5} {...props} />;
}

export function ReceiptText(props: PropsIcono) {
  return <IconReceipt stroke={1.5} {...props} />;
}

export function RefreshCw(props: PropsIcono) {
  return <IconRefresh stroke={1.5} {...props} />;
}

export function Repeat(props: PropsIcono) {
  return <IconRepeat stroke={1.5} {...props} />;
}

export function RotateCcw(props: PropsIcono) {
  return <IconRestore stroke={1.5} {...props} />;
}

export function Ruler(props: PropsIcono) {
  return <IconRuler stroke={1.5} {...props} />;
}

export function Scale(props: PropsIcono) {
  return <IconScale stroke={1.5} {...props} />;
}

export function ScanBarcode(props: PropsIcono) {
  return <IconBarcode stroke={1.5} {...props} />;
}

export function Search(props: PropsIcono) {
  return <IconSearch stroke={1.5} {...props} />;
}

export function SearchIcon(props: PropsIcono) {
  return <IconSearch stroke={1.5} {...props} />;
}

export function Send(props: PropsIcono) {
  return <IconSend stroke={1.5} {...props} />;
}

export function Settings(props: PropsIcono) {
  return <IconSettings stroke={1.5} {...props} />;
}

export function Share2(props: PropsIcono) {
  return <IconShare2 stroke={1.5} {...props} />;
}

export function ShieldAlert(props: PropsIcono) {
  return <IconShieldExclamation stroke={1.5} {...props} />;
}

export function ShieldCheck(props: PropsIcono) {
  return <IconShieldCheck stroke={1.5} {...props} />;
}

export function ShoppingBag(props: PropsIcono) {
  return <IconShoppingBag stroke={1.5} {...props} />;
}

export function ShoppingCart(props: PropsIcono) {
  return <IconShoppingCart stroke={1.5} {...props} />;
}

export function SlidersHorizontal(props: PropsIcono) {
  return <IconAdjustmentsHorizontal stroke={1.5} {...props} />;
}

export function Sparkles(props: PropsIcono) {
  return <IconSparkles stroke={1.5} {...props} />;
}

export function Split(props: PropsIcono) {
  return <IconGitFork stroke={1.5} {...props} />;
}

export function SquarePen(props: PropsIcono) {
  return <IconNote stroke={1.5} {...props} />;
}

export function Star(props: PropsIcono) {
  return <IconStar stroke={1.5} {...props} />;
}

export function Store(props: PropsIcono) {
  return <IconBuildingStore stroke={1.5} {...props} />;
}

export function Storefront(props: PropsIcono) {
  return <IconBuildingStore stroke={1.5} {...props} />;
}

export function Sun(props: PropsIcono) {
  return <IconSun stroke={1.5} {...props} />;
}

export function Tag(props: PropsIcono) {
  return <IconTag stroke={1.5} {...props} />;
}

export function Tags(props: PropsIcono) {
  return <IconTag stroke={1.5} {...props} />;
}

export function ThumbsDown(props: PropsIcono) {
  return <IconThumbDown stroke={1.5} {...props} />;
}

export function ThumbsUp(props: PropsIcono) {
  return <IconThumbUp stroke={1.5} {...props} />;
}

export function Trash2(props: PropsIcono) {
  return <IconTrash stroke={1.5} {...props} />;
}

export function TrendingDown(props: PropsIcono) {
  return <IconTrendingDown stroke={1.5} {...props} />;
}

export function TrendingUp(props: PropsIcono) {
  return <IconTrendingUp stroke={1.5} {...props} />;
}

export function TriangleAlert(props: PropsIcono) {
  return <IconAlertTriangle stroke={1.5} {...props} />;
}

export function TriangleAlertIcon(props: PropsIcono) {
  return <IconAlertTriangle stroke={1.5} {...props} />;
}

export function Truck(props: PropsIcono) {
  return <IconTruck stroke={1.5} {...props} />;
}

export function Undo2(props: PropsIcono) {
  return <IconArrowBackUp stroke={1.5} {...props} />;
}

export function Upload(props: PropsIcono) {
  return <IconUpload stroke={1.5} {...props} />;
}

export function UserPlus(props: PropsIcono) {
  return <IconUserPlus stroke={1.5} {...props} />;
}

export function UserRound(props: PropsIcono) {
  return <IconUser stroke={1.5} {...props} />;
}

export function UserX(props: PropsIcono) {
  return <IconUserMinus stroke={1.5} {...props} />;
}

export function Users(props: PropsIcono) {
  return <IconUsers stroke={1.5} {...props} />;
}

export function UsersRound(props: PropsIcono) {
  return <IconUsers stroke={1.5} {...props} />;
}

export function Wallet(props: PropsIcono) {
  return <IconWallet stroke={1.5} {...props} />;
}

export function Warehouse(props: PropsIcono) {
  return <IconBuildingWarehouse stroke={1.5} {...props} />;
}

export function Wrench(props: PropsIcono) {
  return <IconTool stroke={1.5} {...props} />;
}

export function X(props: PropsIcono) {
  return <IconX stroke={1.5} {...props} />;
}

export function XIcon(props: PropsIcono) {
  return <IconX stroke={1.5} {...props} />;
}

export function Zap(props: PropsIcono) {
  return <IconBolt stroke={1.5} {...props} />;
}

// Iconos por nombre semántico (usados en el menú y las cards de Reportes).
export function TablerHome(props: PropsIcono) {
  return <IconHome stroke={1.5} {...props} />;
}
export function TablerInbox(props: PropsIcono) {
  return <IconInbox stroke={1.5} {...props} />;
}
export function TablerIngresos(props: PropsIcono) {
  return <IconCircleArrowDownLeft stroke={1.5} {...props} />;
}
export function TablerCompras(props: PropsIcono) {
  return <IconCircleArrowUpRight stroke={1.5} {...props} />;
}
export function TablerUsers(props: PropsIcono) {
  return <IconUsers stroke={1.5} {...props} />;
}
export function TablerPackage(props: PropsIcono) {
  return <IconPackage stroke={1.5} {...props} />;
}
export function TablerBank(props: PropsIcono) {
  return <IconBuildingBank stroke={1.5} {...props} />;
}
export function TablerCalculator(props: PropsIcono) {
  return <IconCalculator stroke={1.5} {...props} />;
}
export function TablerTimeline(props: PropsIcono) {
  return <IconTimeline stroke={1.5} {...props} />;
}
export function TablerClipboardCheck(props: PropsIcono) {
  return <IconClipboardCheck stroke={1.5} {...props} />;
}
export function TablerSettings(props: PropsIcono) {
  return <IconSettings stroke={1.5} {...props} />;
}
export function TablerNomina(props: PropsIcono) {
  return <IconIdBadge2 stroke={1.5} {...props} />;
}
export function TablerPos(props: PropsIcono) {
  return <IconCashRegister stroke={1.5} {...props} />;
}
export function TablerFileInvoice(props: PropsIcono) {
  return <IconFileInvoice stroke={1.5} {...props} />;
}
export function TablerCoin(props: PropsIcono) {
  return <IconCoin stroke={1.5} {...props} />;
}
export function TablerChartBar(props: PropsIcono) {
  return <IconChartBarPopular stroke={1.5} {...props} />;
}
export function TablerCash(props: PropsIcono) {
  return <IconCash stroke={1.5} {...props} />;
}
export function TablerReportMoney(props: PropsIcono) {
  return <IconReportMoney stroke={1.5} {...props} />;
}
export function TablerBriefcase(props: PropsIcono) {
  return <IconBriefcase stroke={1.5} {...props} />;
}
export function TablerStar(props: PropsIcono) {
  return <IconStar stroke={1.5} {...props} />;
}
