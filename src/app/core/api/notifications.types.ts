/** `UMS.Modules.Notifications.Application.InApp` -- in-app notification center DTOs. */
export interface InAppNotificationDto {
  readonly id: string;
  readonly category: string;
  readonly title: string;
  readonly body: string;
  readonly isRead: boolean;
  readonly createdAt: string;
}

export interface UnreadCountDto {
  readonly unreadCount: number;
}
