import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Feedback háptico centralizado usando expo-haptics.
 * Soporta patrones ricos en iOS y vibración básica en Android.
 * Cada acción tiene una textura distinta para que el usuario
 * distinga al tacto qué ha ocurrido.
 */

const canHaptic = Platform.OS === 'ios' || Platform.OS === 'android';

/** Toque ligero — pulsación de botón genérica */
export async function feedbackTap() {
  if (!canHaptic) return;
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Pulso corto y definido — QR detectado y leído */
export async function feedbackScan() {
  if (!canHaptic) return;
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
}

/** Doble pulso satisfactorio — sello añadido / operación correcta */
export async function feedbackSuccess() {
  if (!canHaptic) return;
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Pulso de alerta — error, QR inválido o expirado */
export async function feedbackError() {
  if (!canHaptic) return;
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

/**
 * Celebración — premio canjeado con éxito.
 * Dos pulsos separados para amplificar la sensación de recompensa.
 */
export async function feedbackRedeemed() {
  if (!canHaptic) return;
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  setTimeout(
    () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
    200,
  );
}
