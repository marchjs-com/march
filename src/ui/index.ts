// HADI March ui — accessible components, dialogs, toasts, navigation, command palette and shortcuts.
// Styles: import "hadi-march/css/tokens.css"; each component brings its own CSS (the March esbuild plugin bundles only
// what you use, per lazy chunk). Without the plugin, import "hadi-march/css/ui.css" (everything).
export { action, isAction } from "./action.ts";
export type { Action, ActionOptions, ReasonOptions } from "./action.ts";
export { Button, IconButton, ActionButton, ButtonGroup, CopyButton } from "./button.ts";
export { Menu, Dropdown, Tooltip } from "./menu.ts";
export type { ButtonProps, ButtonVariant, ButtonSize, IconButtonProps, ButtonGroupProps, ActionButtonProps, CopyButtonProps } from "./button.ts";
export type { MenuItem, MenuItemSpec, MenuProps, PopoverButtonProps, DropdownProps, TooltipProps } from "./menu.ts";
export { Dialog, Drawer, openDialog, openDrawer, confirm, prompt, askReason, closeAll, openDialogs } from "./dialog.ts";
export type {
  DialogProps, DialogOptions, DialogSize, DrawerSide, Label, ConfirmOptions, PromptOptions, AskReasonOptions, Purpose, ReasonWithPurpose,
} from "./dialog.ts";
export { toast, ToastHost } from "./toast.ts";
export type { Toast, ToastOptions, ToastAction, ToastItem, ToastKind } from "./toast.ts";
export { Tabs, Tab } from "./tabs.ts";
export type { TabsProps, TabProps, TabSpec, TabDescriptor } from "./tabs.ts";
export {
  Card, Badge, countLabel, Empty, Spinner, ErrorBox, Skeleton, Alert, Notice, Kbd, Avatar, initials, CodeView, JsonView, KeyValue, Timeline,
  Stack, Grid, Toolbar, Divider, Loader, bootLoader,
} from "./display.ts";
export type {
  Tone, ActionsProp, CardProps, BadgeProps, EmptyProps, SpinnerProps, ErrorBoxProps, SkeletonProps, AlertProps, KbdProps, AvatarProps,
  CodeViewProps, JsonViewProps, KeyValueProps, KeyValueItem, TimelineProps, TimelineItem, Align, StackProps, GridProps, ToolbarProps,
  DividerProps, LoaderProps,
} from "./display.ts";
export { Page, Section, ListDetail, Pager, SearchBox, AppShell } from "./layout.ts";
export type { PageProps, Breadcrumb, SectionProps, ListDetailProps, PagerProps, SearchBoxProps, AppShellProps } from "./layout.ts";
export { NavMenu } from "./nav.ts";
export type { NavMenuProps, NavItem, NavSort } from "./nav.ts";
export { CommandPalette, PaletteButton, openPalette, closePalette, paletteOpen, preloadPalette, registerCommands, registerPages } from "./palette.ts";
export type { PaletteButtonProps, CommandPaletteProps, PaletteEntry, AskResult, Command, CommandEntry, PageEntry } from "./palette.ts";
export { key, shortcuts, formatKey, parseKey, isMac } from "./keys.ts";
export type { KeyOptions, ParsedKey, ShortcutInfo } from "./keys.ts";
export { Overlay, quietMedia } from "./overlay.ts";
export type { OverlayProps, OverlayEffect, OverlayFit, DrawFn, DrawContext } from "./overlay.ts";
export { accent, setAccent, AccentPicker, ACCENT_CHOICES } from "./accent.ts";
export type { AccentPickerProps } from "./accent.ts";
export { theme, setTheme, resolvedTheme, ThemeToggle, LocaleSelect, UpdateBanner, colorTheme, setColorTheme, colorThemes, registerThemes, loadTheme, setThemeBase, ThemePicker, ThemeSwatch } from "./theme.ts";
export type { ThemeInfo, ThemePickerProps, Theme, ThemeMode, ThemeToggleProps, LocaleSelectProps, LocaleOption, UpdateBannerProps } from "./theme.ts";
export { fold, score, rank, distance } from "./fold.ts";
export type { Keywords, RankFields, Ranked } from "./fold.ts";
export { place } from "./popover.ts";
export type { Placement, PlacedStyle } from "./popover.ts";
export { Media, openMedia, mediaKind } from "./media.ts";
export type { MediaProps, MediaKind, OpenMediaOptions } from "./media.ts";
export type { MaybeFn, ClassValue, ClassProp } from "./util.ts";
export * from "../forms/index.ts";
export { Disclosure } from "./disclosure.ts";
export type { DisclosureProps } from "./disclosure.ts";
export { Brand, AuthLayout, UserMenu, IconTile, LinkCard, Spacer } from "./app.ts";
export type { BrandProps, AuthLayoutProps, UserMenuProps, IconTileProps, IconTone, LinkCardProps } from "./app.ts";
export { Chip } from "./chip.ts";
export { OverflowText, Marquee } from "./marquee.ts";
export { AvatarGroup } from "./avatar-group.ts";
export { Progress } from "./progress.ts";
export { Rating } from "./rating.ts";
export { Accordion } from "./accordion.ts";
export { Steps } from "./steps.ts";
export { Pagination } from "./pagination.ts";
export { Carousel } from "./carousel.ts";
export { Tree } from "./tree.ts";
export { Kanban } from "./kanban.ts";
export { Splitter } from "./splitter.ts";
export type { ChipProps } from "./chip.ts";
export type { OverflowTextProps, MarqueeTrigger, MarqueeMode } from "./marquee.ts";
export type { AvatarGroupProps } from "./avatar-group.ts";
export type { ProgressProps } from "./progress.ts";
export type { RatingProps } from "./rating.ts";
export type { AccordionProps, AccordionItem } from "./accordion.ts";
export type { StepsProps, StepItem } from "./steps.ts";
export type { PaginationProps } from "./pagination.ts";
export type { CarouselProps } from "./carousel.ts";
export type { TreeProps, TreeNode } from "./tree.ts";
export type { KanbanProps, KanbanColumn } from "./kanban.ts";
export type { SplitterProps } from "./splitter.ts";
export { NavSidebar } from "./sidebar.ts";
export type { NavSidebarProps, NavSidebarItem } from "./sidebar.ts";
