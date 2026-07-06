export type GiftCardFormType = 'plan' | 'credit';

export type GiftCardCard = {
  code: string;
  type: 'credit' | 'plan';
  amountCents: number;
  planId: string | null;
  planName: string | null;
  fiveHourTokenLimit: number;
  weeklyTokenLimit: number;
  planRank: number;
  durationMonths: number;
  redeemedAt: string | null;
  revokedAt: string | null;
  createdByUserId?: string | null;
  createdByEmail?: string | null;
  redeemedByUserId?: string | null;
  redeemedByEmail?: string | null;
  revokedByUserId?: string | null;
  revokedByEmail?: string | null;
  createdAt?: string;
};

export type AdminGiftCard = Required<Pick<GiftCardCard, 'code' | 'type' | 'amountCents' | 'planId' | 'planName' | 'fiveHourTokenLimit' | 'weeklyTokenLimit' | 'planRank' | 'durationMonths' | 'redeemedAt' | 'revokedAt'>> & {
  createdByUserId: string | null;
  createdByEmail: string | null;
  redeemedByUserId: string | null;
  redeemedByEmail: string | null;
  revokedByUserId: string | null;
  revokedByEmail: string | null;
  createdAt: string;
};

export type GiftCardPage = {
  giftCards: AdminGiftCard[];
  total: number;
  typeCounts: Record<GiftCardFormType, number>;
  page: number;
  pageSize: number;
};

export type GiftCardCurrentPlan = {
  currentPlanId: string | null;
  currentPlanName: string | null;
  currentPlanRank: number;
  planExpiresAt: string | null;
};

export type GiftCardPreview = {
  card: GiftCardCard;
  currentPlan: GiftCardCurrentPlan;
  consequence: 'credit' | 'upgrade' | 'extend';
  canUse: boolean;
  message: string;
  requiresConfirmation: boolean;
  redeemed: boolean;
};
