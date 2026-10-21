export type GoogleDriveStoredTokens = {
  connected: true;
  connectedAt: string;
  email?: string | null;
  refreshToken: string;
  accessToken?: string | null;
  accessTokenExpiresAt?: string | null;
  rootFolderId?: string | null;
};

export type GoogleDriveStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
  androidClientId: string | null;
};

export type GoogleDriveUploadResult = {
  fileId: string;
  webViewLink: string | null;
  webContentLink: string | null;
  mimeType: string;
  name: string;
};
