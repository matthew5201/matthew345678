import type { ReactNode } from 'react'

// 描邊風格的內嵌 SVG 圖示，與設計稿一致。純裝飾，所以預設 aria-hidden。
function Icon({ size = 20, children, strokeWidth = 2 }: { size?: number; children: ReactNode; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  )
}

type P = { size?: number }

export const ChatIcon = ({ size = 40 }: P) => (
  <Icon size={size} strokeWidth={1.6}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z" />
    <path d="M9 11h6M9 14h3" />
  </Icon>
)
export const PlusIcon = ({ size = 18 }: P) => (
  <Icon size={size} strokeWidth={2.2}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)
export const AlertIcon = ({ size = 18 }: P) => (
  <Icon size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16.5v.01" />
  </Icon>
)
export const CopyIcon = ({ size = 14 }: P) => (
  <Icon size={size}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h8" />
  </Icon>
)
export const UsersIcon = ({ size = 16 }: P) => (
  <Icon size={size}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.5A6.5 6.5 0 0 1 21.5 20" />
  </Icon>
)
export const CloseIcon = ({ size = 20 }: P) => (
  <Icon size={size}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
)
export const WifiOffIcon = ({ size = 18 }: P) => (
  <Icon size={size}>
    <path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20v.01M3 3l18 18" />
  </Icon>
)
export const SmileIcon = ({ size = 24 }: P) => (
  <Icon size={size} strokeWidth={1.8}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 14a4.5 4.5 0 0 0 7 0M9 9.5v.01M15 9.5v.01" />
  </Icon>
)
export const PaperclipIcon = ({ size = 24 }: P) => (
  <Icon size={size} strokeWidth={1.8}>
    <path d="M20 11.5l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.5 3.5 0 0 1 5 5L10 17.5a2 2 0 0 1-3-3l7.5-7.5" />
  </Icon>
)
export const SendIcon = ({ size = 22 }: P) => (
  <Icon size={size} strokeWidth={2.2}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
)
export const FileIcon = ({ size = 28 }: P) => (
  <Icon size={size} strokeWidth={1.8}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </Icon>
)
