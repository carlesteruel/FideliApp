import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Image, ImageBackground,
  TouchableOpacity, Alert, Share, Clipboard,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withDelay,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../store/useAuthStore';
import { LoyaltyCardWithCampaign } from '../types/database';
import { colors, fonts } from '../theme';
import {
  CATEGORY_COLORS, CATEGORY_EMOJI,
  CATEGORY_DEFAULT_COVERS,
} from '../constants/businessAssets';
import { CircularProgress } from './ui/CircularProgress';
import { PressableScale } from './ui/PressableScale';
import type {
  StreakConfig, BirthdayConfig, MinSpendConfig,
  MonthlyVisitsConfig, PointsConfig, ReferralConfig,
} from '../types/database';

interface PunchCardProps {
  card: LoyaltyCardWithCampaign;
  onPress?: () => void;
}

const CAMPAIGN_TYPE_LABEL: Record<string, string> = {
  punch_card:     '🎟️ Tarjeta de sellos',
  points:         '⭐ Puntos',
  birthday:       '🎂 Cumpleaños',
  streak:         '🔥 Racha de visitas',
  cashback:       '💶 Cashback',
  referral:       '👥 Referidos',
  first_visit:    '🌟 Primera visita',
  min_spend:      '💳 Gasto mínimo',
  monthly_visits: '📅 Visitas mensuales',
};

// ── Barra de progreso animada ────────────────────────────────────────
function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.min(current / total, 1) : 0;
  const [barWidth, setBarWidth] = useState(0);
  const fillWidth = useSharedValue(0);

  useEffect(() => {
    if (barWidth > 0) {
      fillWidth.value = withTiming(pct * barWidth, {
        duration: 900,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [pct, barWidth]);

  const animFill = useAnimatedStyle(() => ({ width: fillWidth.value }));

  return (
    <View
      style={s.progressBg}
      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View style={[s.progressFill, animFill]} />
    </View>
  );
}

// ── Shimmer hook — efecto de brillo deslizante ───────────────────────
function useShimmer() {
  const shimmerX = useSharedValue(-220);
  useEffect(() => {
    shimmerX.value = withDelay(
      600,
      withRepeat(
        withTiming(480, { duration: 2800, easing: Easing.linear }),
        -1,
        false,
      ),
    );
  }, []);
  return useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));
}

// ── Cabecera con imagen de fondo + gradiente + shimmer ───────────────
function CardHeader({
  coverUrl, category, color, children,
}: {
  coverUrl: string | null | undefined;
  category: string;
  color: string;
  children: React.ReactNode;
}) {
  const imageUri   = coverUrl ?? CATEGORY_DEFAULT_COVERS[category] ?? CATEGORY_DEFAULT_COVERS.other;
  const isCustom   = !!coverUrl;
  const shimmerStyle = useShimmer();

  return (
    <ImageBackground
      source={{ uri: imageUri }}
      style={[s.header, { backgroundColor: color }]}
      imageStyle={{ opacity: isCustom ? 0.50 : 0.42 }}
      resizeMode="cover"
    >
      {/* Gradiente premium: color del negocio → negro oscuro */}
      <LinearGradient
        colors={[`${color}E0`, `${color}88`, '#00000060']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Shimmer deslizante — acabado holográfico */}
      <Animated.View
        style={[s.shimmerWrap, shimmerStyle]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.14)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </Animated.View>

      {children}
    </ImageBackground>
  );
}

// ── Logo o emoji del negocio ─────────────────────────────────────────
function BusinessLogo({
  logoUrl, category,
}: { logoUrl: string | null; category: string }) {
  return logoUrl ? (
    <Image source={{ uri: logoUrl }} style={s.logoImg} />
  ) : (
    <View style={s.emojiBox}>
      <Text style={s.emoji}>{CATEGORY_EMOJI[category] ?? '🏪'}</Text>
    </View>
  );
}

// ── Fila de premio ───────────────────────────────────────────────────
function RewardRow({
  description, timesCompleted,
}: { description: string; timesCompleted: number }) {
  return (
    <View style={s.rewardRow}>
      <Text style={{ fontSize: 22, marginRight: 12 }}>🎁</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.rewardLabel}>Premio</Text>
        <Text style={s.rewardText}>{description}</Text>
      </View>
      {timesCompleted > 0 && (
        <View style={s.badge}>
          <Text style={s.badgeText}>×{timesCompleted} canjeado</Text>
        </View>
      )}
    </View>
  );
}

// ── Sello con animación de "pop" para el último sello ────────────────
function Stamp({
  index, filled, color, lastIndex,
}: { index: number; filled: boolean; color: string; lastIndex: number }) {
  const scale = useSharedValue(filled && index === lastIndex ? 0 : 1);

  useEffect(() => {
    if (filled && index === lastIndex) {
      scale.value = withDelay(
        index * 40,
        withSpring(1, { damping: 10, stiffness: 200, overshootClamping: false }),
      );
    }
  }, [filled]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        animStyle,
        s.stamp,
        filled
          ? { backgroundColor: color }
          : { backgroundColor: `${color}1A`, borderWidth: 2, borderColor: `${color}55` },
      ]}
    >
      {filled
        ? <Text style={s.stampCheck}>✓</Text>
        : <Text style={s.stampNum}>{index + 1}</Text>}
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL PunchCard
// ═══════════════════════════════════════════════════════════════════════
export function PunchCard({ card, onPress }: PunchCardProps) {
  const campaign = card.campaigns;
  const { profile: authProfile } = useAuthStore();

  if (!campaign || !campaign.businesses) {
    return (
      <PressableScale onPress={onPress} style={s.card}>
        <View style={[s.header, { backgroundColor: colors.gray400 }]}>
          <View style={s.headerRow}>
            <View>
              <Text style={s.businessName}>Negocio no disponible</Text>
              <Text style={s.campaignName} numberOfLines={1}>—</Text>
            </View>
            <View style={s.emojiBox}><Text style={s.emoji}>❓</Text></View>
          </View>
        </View>
        <View style={s.body}>
          <Text style={{ color: colors.gray400, fontSize: 13, textAlign: 'center', fontFamily: fonts.regular }}>
            Esta tarjeta ya no está disponible
          </Text>
        </View>
      </PressableScale>
    );
  }

  const business     = campaign.businesses;
  const cardColor    = business.card_color ?? CATEGORY_COLORS[business.category] ?? colors.primary500;
  const campaignType = campaign.type;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config       = campaign.config as any;

  // ─────────────────────────────────────────────────────────
  // 1. PUNCH CARD — grid de sellos con animación pop
  // ─────────────────────────────────────────────────────────
  if (campaignType === 'punch_card') {
    const totalStamps   = config?.total_stamps ?? 10;
    const currentStamps = card.current_stamps;

    return (
      <PressableScale onPress={onPress} style={s.card}>
        <CardHeader coverUrl={business.cover_url} category={business.category} color={cardColor}>
          <View style={s.headerRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={s.businessName}>{business.name}</Text>
              <Text style={s.campaignName} numberOfLines={1}>{campaign.name}</Text>
            </View>
            <BusinessLogo logoUrl={business.logo_url} category={business.category} />
          </View>
          <ProgressBar current={currentStamps} total={totalStamps} />
          <Text style={s.progressText}>{currentStamps} / {totalStamps} sellos</Text>
        </CardHeader>

        <View style={s.body}>
          <View style={s.stampsGrid}>
            {Array.from({ length: totalStamps }).map((_, i) => (
              <Stamp
                key={i}
                index={i}
                filled={i < currentStamps}
                color={cardColor}
                lastIndex={currentStamps - 1}
              />
            ))}
          </View>
          <RewardRow description={campaign.reward_description} timesCompleted={card.times_completed} />
        </View>
      </PressableScale>
    );
  }

  // ─────────────────────────────────────────────────────────
  // 2. POINTS — CircularProgress como elemento hero
  // ─────────────────────────────────────────────────────────
  if (campaignType === 'points') {
    const pointsPerEuro  = (config as PointsConfig)?.points_per_euro  ?? 10;
    const pointsToReward = (config as PointsConfig)?.points_to_reward ?? 0;
    const currentPoints  = card.current_points;
    const pct            = pointsToReward > 0 ? Math.min(currentPoints / pointsToReward, 1) : 0;
    const remaining      = Math.max(0, pointsToReward - currentPoints);

    return (
      <PressableScale onPress={onPress} style={s.card}>
        <CardHeader coverUrl={business.cover_url} category={business.category} color={cardColor}>
          <View style={s.headerRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={s.businessName}>{business.name}</Text>
              <Text style={s.campaignName} numberOfLines={1}>{campaign.name}</Text>
            </View>
            <BusinessLogo logoUrl={business.logo_url} category={business.category} />
          </View>
          <Text style={s.progressText}>⭐ Toca para canjear puntos</Text>
        </CardHeader>

        <View style={s.body}>
          {/* Hero: CircularProgress centrado */}
          <View style={s.pointsHero}>
            <CircularProgress
              size={140}
              strokeWidth={12}
              progress={pct}
              color={cardColor}
              trackColor={colors.background}
              label={currentPoints}
              sublabel={pointsToReward > 0 ? `de ${pointsToReward} pts` : 'pts'}
              labelColor={colors.accent}
            />
            {/* Tasa de puntos */}
            <View style={s.pointsRate}>
              <Text style={s.pointsRateLabel}>por €</Text>
              <Text style={[s.pointsRateValue, { color: cardColor }]}>{pointsPerEuro} pts</Text>
            </View>
          </View>

          {pointsToReward > 0 && (
            <View style={s.infoRow}>
              <Text style={s.infoEmoji}>🎯</Text>
              <View>
                <Text style={s.infoLabel}>Siguiente premio</Text>
                <Text style={s.infoValue}>{remaining} pts restantes</Text>
              </View>
            </View>
          )}

          <RewardRow description={campaign.reward_description} timesCompleted={card.times_completed} />
        </View>
      </PressableScale>
    );
  }

  // ─────────────────────────────────────────────────────────
  // 3. STREAK — burbujas de fuego
  // ─────────────────────────────────────────────────────────
  if (campaignType === 'streak') {
    const visitsRequired = (config as StreakConfig)?.visits_required ?? 5;
    const periodDays     = (config as StreakConfig)?.period_days     ?? 7;
    const currentStreak  = card.current_streak;

    return (
      <PressableScale onPress={onPress} style={s.card}>
        <CardHeader coverUrl={business.cover_url} category={business.category} color={cardColor}>
          <View style={s.headerRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={s.businessName}>{business.name}</Text>
              <Text style={s.campaignName} numberOfLines={1}>{campaign.name}</Text>
            </View>
            <BusinessLogo logoUrl={business.logo_url} category={business.category} />
          </View>
          <ProgressBar current={currentStreak} total={visitsRequired} />
          <Text style={s.progressText}>🔥 {currentStreak} / {visitsRequired} visitas seguidas</Text>
        </CardHeader>

        <View style={s.body}>
          <View style={s.stampsGrid}>
            {Array.from({ length: visitsRequired }).map((_, i) => {
              const done = i < currentStreak;
              return (
                <Stamp
                  key={i}
                  index={i}
                  filled={done}
                  color="#FF6B35"
                  lastIndex={currentStreak - 1}
                />
              );
            })}
          </View>

          <View style={[s.infoRow, { marginBottom: 12 }]}>
            <Text style={s.infoEmoji}>⏱️</Text>
            <View>
              <Text style={s.infoLabel}>Ventana de tiempo</Text>
              <Text style={s.infoValue}>{periodDays} días entre visitas</Text>
            </View>
          </View>

          <RewardRow description={campaign.reward_description} timesCompleted={card.times_completed} />
        </View>
      </PressableScale>
    );
  }

  // ─────────────────────────────────────────────────────────
  // 4. BIRTHDAY
  // ─────────────────────────────────────────────────────────
  if (campaignType === 'birthday') {
    const daysWindow = (config as BirthdayConfig)?.days_window ?? 7;

    return (
      <PressableScale onPress={onPress} style={s.card}>
        <CardHeader coverUrl={business.cover_url} category={business.category} color={cardColor}>
          <View style={s.headerRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={s.businessName}>{business.name}</Text>
              <Text style={s.campaignName} numberOfLines={1}>{campaign.name}</Text>
            </View>
            <BusinessLogo logoUrl={business.logo_url} category={business.category} />
          </View>
          <Text style={[s.progressText, { marginTop: 0 }]}>🎂 Premio de cumpleaños</Text>
        </CardHeader>

        <View style={s.body}>
          <View style={s.specialBanner}>
            <Text style={{ fontSize: 36 }}>🎉</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.specialBannerTitle}>¡Premio de cumpleaños!</Text>
              <Text style={s.specialBannerSub}>
                Disponible {daysWindow} días alrededor de tu cumpleaños
              </Text>
            </View>
          </View>
          <View style={[s.infoRow, { marginBottom: 12 }]}>
            <Text style={s.infoEmoji}>✨</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.infoLabel}>¿Cómo funciona?</Text>
              <Text style={s.infoValue}>Se genera automáticamente en tu cumpleaños</Text>
            </View>
          </View>
          <RewardRow description={campaign.reward_description} timesCompleted={card.times_completed} />
        </View>
      </PressableScale>
    );
  }

  // ─────────────────────────────────────────────────────────
  // 5. FIRST VISIT
  // ─────────────────────────────────────────────────────────
  if (campaignType === 'first_visit') {
    const hasVisited = card.total_stamps_ever > 0;

    return (
      <PressableScale onPress={onPress} style={s.card}>
        <CardHeader coverUrl={business.cover_url} category={business.category} color={cardColor}>
          <View style={s.headerRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={s.businessName}>{business.name}</Text>
              <Text style={s.campaignName} numberOfLines={1}>{campaign.name}</Text>
            </View>
            <BusinessLogo logoUrl={business.logo_url} category={business.category} />
          </View>
          <Text style={[s.progressText, { marginTop: 0 }]}>🌟 Premio por primera visita</Text>
        </CardHeader>

        <View style={s.body}>
          <View style={[
            s.specialBanner,
            { backgroundColor: hasVisited ? `${colors.green500}15` : `${cardColor}15` },
          ]}>
            <Text style={{ fontSize: 36 }}>{hasVisited ? '✅' : '🌟'}</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[s.specialBannerTitle, { color: hasVisited ? colors.green600 : colors.accent }]}>
                {hasVisited ? '¡Primera visita registrada!' : 'Visita por primera vez'}
              </Text>
              <Text style={[s.specialBannerSub, { color: hasVisited ? colors.green500 : colors.gray500 }]}>
                {hasVisited ? 'Tu premio ha sido generado' : 'Consigue tu premio en la primera visita'}
              </Text>
            </View>
          </View>
          <RewardRow description={campaign.reward_description} timesCompleted={card.times_completed} />
        </View>
      </PressableScale>
    );
  }

  // ─────────────────────────────────────────────────────────
  // 6. MIN SPEND
  // ─────────────────────────────────────────────────────────
  if (campaignType === 'min_spend') {
    const minAmount = (config as MinSpendConfig)?.min_amount ?? 20;

    return (
      <PressableScale onPress={onPress} style={s.card}>
        <CardHeader coverUrl={business.cover_url} category={business.category} color={cardColor}>
          <View style={s.headerRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={s.businessName}>{business.name}</Text>
              <Text style={s.campaignName} numberOfLines={1}>{campaign.name}</Text>
            </View>
            <BusinessLogo logoUrl={business.logo_url} category={business.category} />
          </View>
          <Text style={[s.progressText, { marginTop: 0 }]}>💳 Premio por gasto mínimo</Text>
        </CardHeader>

        <View style={s.body}>
          <View style={[s.infoRow, { marginBottom: 12 }]}>
            <Text style={s.infoEmoji}>💶</Text>
            <View>
              <Text style={s.infoLabel}>Gasto mínimo requerido</Text>
              <Text style={[s.infoValue, { fontSize: 22 }]}>{minAmount.toFixed(2)} €</Text>
            </View>
          </View>
          {card.times_completed > 0 && (
            <View style={[s.infoRow, { marginBottom: 12, backgroundColor: `${colors.green500}12` }]}>
              <Text style={s.infoEmoji}>🏆</Text>
              <View>
                <Text style={[s.infoLabel, { color: colors.green600 }]}>Veces ganado</Text>
                <Text style={[s.infoValue, { color: colors.green700 }]}>
                  {card.times_completed} vez{card.times_completed !== 1 ? 'es' : ''}
                </Text>
              </View>
            </View>
          )}
          <RewardRow description={campaign.reward_description} timesCompleted={card.times_completed} />
        </View>
      </PressableScale>
    );
  }

  // ─────────────────────────────────────────────────────────
  // 7. MONTHLY VISITS
  // ─────────────────────────────────────────────────────────
  if (campaignType === 'monthly_visits') {
    const visitsRequired  = (config as MonthlyVisitsConfig)?.visits_required ?? 4;
    const lastVisitAt     = card.last_visit_at ? new Date(card.last_visit_at) : null;
    const now             = new Date();
    const isCurrentMonth  = lastVisitAt
      ? lastVisitAt.getFullYear() === now.getFullYear() && lastVisitAt.getMonth() === now.getMonth()
      : false;
    const effectiveVisits = isCurrentMonth ? card.current_stamps : 0;
    const MONTH_NAMES     = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthLabel      = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

    return (
      <PressableScale onPress={onPress} style={s.card}>
        <CardHeader coverUrl={business.cover_url} category={business.category} color={cardColor}>
          <View style={s.headerRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={s.businessName}>{business.name}</Text>
              <Text style={s.campaignName} numberOfLines={1}>{campaign.name}</Text>
            </View>
            <BusinessLogo logoUrl={business.logo_url} category={business.category} />
          </View>
          <ProgressBar current={effectiveVisits} total={visitsRequired} />
          <Text style={s.progressText}>📅 {effectiveVisits} / {visitsRequired} visitas · {monthLabel}</Text>
        </CardHeader>

        <View style={s.body}>
          <View style={s.stampsGrid}>
            {Array.from({ length: visitsRequired }).map((_, i) => (
              <Stamp
                key={i}
                index={i}
                filled={i < effectiveVisits}
                color={cardColor}
                lastIndex={effectiveVisits - 1}
              />
            ))}
          </View>
          {card.times_completed > 0 && (
            <View style={[s.infoRow, { marginBottom: 12 }]}>
              <Text style={s.infoEmoji}>🏆</Text>
              <View>
                <Text style={s.infoLabel}>Meses completados</Text>
                <Text style={s.infoValue}>
                  {card.times_completed} mes{card.times_completed !== 1 ? 'es' : ''}
                </Text>
              </View>
            </View>
          )}
          <RewardRow description={campaign.reward_description} timesCompleted={card.times_completed} />
        </View>
      </PressableScale>
    );
  }

  // ─────────────────────────────────────────────────────────
  // 8. REFERRAL
  // ─────────────────────────────────────────────────────────
  if (campaignType === 'referral') {
    const referrerReward = (config as ReferralConfig)?.referrer_reward ?? '';
    const refereeReward  = (config as ReferralConfig)?.referee_reward  ?? '';

    return (
      <PressableScale onPress={onPress} style={s.card}>
        <CardHeader coverUrl={business.cover_url} category={business.category} color={cardColor}>
          <View style={s.headerRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={s.businessName}>{business.name}</Text>
              <Text style={s.campaignName} numberOfLines={1}>{campaign.name}</Text>
            </View>
            <BusinessLogo logoUrl={business.logo_url} category={business.category} />
          </View>
          <Text style={[s.progressText, { marginTop: 0 }]}>👥 Programa de referidos</Text>
        </CardHeader>

        <View style={s.body}>
          <View style={[s.infoRow, { marginBottom: 12 }]}>
            <Text style={s.infoEmoji}>👥</Text>
            <View>
              <Text style={s.infoLabel}>Referidos confirmados</Text>
              <Text style={[s.infoValue, { fontSize: 22 }]}>{card.times_completed}</Text>
            </View>
          </View>
          {!!referrerReward && (
            <View style={[s.infoRow, { marginBottom: 12 }]}>
              <Text style={s.infoEmoji}>🎁</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.infoLabel}>Tu premio por referir</Text>
                <Text style={s.infoValue}>{referrerReward}</Text>
              </View>
            </View>
          )}
          {!!refereeReward && (
            <View style={[s.infoRow, { marginBottom: 12 }]}>
              <Text style={s.infoEmoji}>🎟️</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.infoLabel}>Premio del amigo referido</Text>
                <Text style={s.infoValue}>{refereeReward}</Text>
              </View>
            </View>
          )}
          {/* Código de referido para compartir directamente desde la tarjeta */}
          {authProfile?.referral_code && (
            <View style={s.referralCodeBlock}>
              <Text style={s.referralCodeBlockLabel}>Tu código para invitar amigos</Text>
              <Text style={[s.referralCodeBlockValue, { color: cardColor }]}>
                {authProfile.referral_code}
              </Text>
              <View style={s.referralCodeBlockBtns}>
                <TouchableOpacity
                  style={[s.referralCodeBtn, { backgroundColor: `${cardColor}18`, borderWidth: 1, borderColor: `${cardColor}40` }]}
                  onPress={() => {
                    Clipboard.setString(authProfile.referral_code ?? '');
                    Alert.alert('¡Copiado!', 'Tu código está en el portapapeles.');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.referralCodeBtnText, { color: cardColor }]}>📋 Copiar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.referralCodeBtn, { backgroundColor: cardColor }]}
                  onPress={() => Share.share({
                    message: `¡Únete a FideliApp con mi código ${authProfile.referral_code} y recibe premios exclusivos! 🎁`,
                  })}
                  activeOpacity={0.7}
                >
                  <Text style={[s.referralCodeBtnText, { color: '#fff' }]}>📤 Compartir</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          <RewardRow description={campaign.reward_description} timesCompleted={card.times_completed} />
        </View>
      </PressableScale>
    );
  }

  // ─────────────────────────────────────────────────────────
  // 9. CASHBACK
  // ─────────────────────────────────────────────────────────
  if (campaignType === 'cashback') {
    const percentage  = config?.percentage  ?? 0;
    const minPurchase = config?.min_purchase ?? 0;

    return (
      <PressableScale onPress={onPress} style={s.card}>
        <CardHeader coverUrl={business.cover_url} category={business.category} color={cardColor}>
          <View style={s.headerRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={s.businessName}>{business.name}</Text>
              <Text style={s.campaignName} numberOfLines={1}>{campaign.name}</Text>
            </View>
            <BusinessLogo logoUrl={business.logo_url} category={business.category} />
          </View>
          <Text style={[s.progressText, { marginTop: 0 }]}>💶 Cashback {percentage}%</Text>
        </CardHeader>

        <View style={s.body}>
          <View style={[s.infoRow, { marginBottom: 12 }]}>
            <Text style={s.infoEmoji}>💶</Text>
            <View>
              <Text style={s.infoLabel}>Porcentaje de cashback</Text>
              <Text style={[s.infoValue, { fontSize: 22 }]}>{percentage}%</Text>
            </View>
          </View>
          {minPurchase > 0 && (
            <View style={[s.infoRow, { marginBottom: 12 }]}>
              <Text style={s.infoEmoji}>🛒</Text>
              <View>
                <Text style={s.infoLabel}>Compra mínima</Text>
                <Text style={s.infoValue}>{Number(minPurchase).toFixed(2)} €</Text>
              </View>
            </View>
          )}
          <RewardRow description={campaign.reward_description} timesCompleted={card.times_completed} />
        </View>
      </PressableScale>
    );
  }

  // ─────────────────────────────────────────────────────────
  // FALLBACK
  // ─────────────────────────────────────────────────────────
  const typeLabel = CAMPAIGN_TYPE_LABEL[campaignType] ?? campaignType;
  return (
    <PressableScale onPress={onPress} style={s.card}>
      <CardHeader coverUrl={business.cover_url} category={business.category} color={cardColor}>
        <View style={s.headerRow}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={s.businessName}>{business.name}</Text>
            <Text style={s.campaignName} numberOfLines={1}>{campaign.name}</Text>
          </View>
          <BusinessLogo logoUrl={business.logo_url} category={business.category} />
        </View>
        <Text style={[s.progressText, { marginTop: 0 }]}>{typeLabel}</Text>
      </CardHeader>
      <View style={s.body}>
        <RewardRow description={campaign.reward_description} timesCompleted={card.times_completed} />
      </View>
    </PressableScale>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // ── Tarjeta ─────────────────────────────────────────────────
  card: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    // Sombra premium
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },

  // ── Header ──────────────────────────────────────────────────
  header:       { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  shimmerWrap:  { position: 'absolute', top: 0, bottom: 0, width: 200 },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  businessName: {
    color: 'rgba(255,255,255,0.80)',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  campaignName: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: fonts.bold,
    marginTop: 2,
  },
  emojiBox:     { width: 48, height: 48, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  logoImg:      { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)' },
  emoji:        { fontSize: 24 },

  // ── Progress bar ─────────────────────────────────────────────
  progressBg:   { height: 7, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.white, borderRadius: 99 },
  progressText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontFamily: fonts.regular, marginTop: 6, textAlign: 'right' },

  // ── Body ─────────────────────────────────────────────────────
  body: { backgroundColor: colors.surface, paddingHorizontal: 20, paddingVertical: 20 },

  // ── Stamps grid ──────────────────────────────────────────────
  stampsGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16 },
  stamp:       { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stampCheck:  { color: colors.white, fontSize: 16, fontWeight: '700' },
  stampNum:    { color: colors.gray300, fontSize: 12 },

  // ── Points hero ──────────────────────────────────────────────
  pointsHero: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            24,
    marginBottom:   16,
    paddingVertical: 8,
  },
  pointsRate:       { alignItems: 'center' },
  pointsRateLabel:  { color: colors.gray400, fontSize: 12, fontFamily: fonts.regular, marginBottom: 2 },
  pointsRateValue:  { fontSize: 22, fontWeight: '800', fontFamily: fonts.extrabold },

  // ── Reward row ───────────────────────────────────────────────
  rewardRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
  rewardLabel: { color: colors.gray400, fontSize: 12, fontWeight: '500', fontFamily: fonts.regular },
  rewardText:  { color: colors.accent, fontWeight: '700', fontFamily: fonts.bold, fontSize: 14 },
  badge:       { backgroundColor: colors.primary100, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText:   { color: colors.primary600, fontSize: 12, fontWeight: '700', fontFamily: fonts.bold },

  // ── Info row ─────────────────────────────────────────────────
  infoRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12 },
  infoEmoji:   { fontSize: 22, marginRight: 12 },
  infoLabel:   { color: colors.gray400, fontSize: 12, fontWeight: '500', fontFamily: fonts.regular },
  infoValue:   { color: colors.accent, fontWeight: '700', fontFamily: fonts.bold, fontSize: 14 },

  // ── Special banner ───────────────────────────────────────────
  specialBanner:      { flexDirection: 'row', alignItems: 'center', backgroundColor: `${colors.primary500}12`, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12 },
  specialBannerTitle: { color: colors.accent, fontWeight: '700', fontFamily: fonts.bold, fontSize: 15 },
  specialBannerSub:   { color: colors.gray500, fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },

  // ── Referral code block ──────────────────────────────────
  referralCodeBlock:      { backgroundColor: colors.background, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12 },
  referralCodeBlockLabel: { color: colors.gray400, fontSize: 12, fontWeight: '500', fontFamily: fonts.regular, marginBottom: 8, textAlign: 'center' },
  referralCodeBlockValue: { fontSize: 26, fontWeight: '800', letterSpacing: 3, textAlign: 'center', marginBottom: 12 },
  referralCodeBlockBtns:  { flexDirection: 'row', gap: 10 },
  referralCodeBtn:        { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  referralCodeBtnText:    { fontWeight: '700', fontSize: 13 },
});
