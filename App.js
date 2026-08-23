import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import {
  AppState,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  endConnection,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
} from 'react-native-iap';

// =====================================================================
// EyeTally — daily eye drop tally
//
// Architecture:
//   - App owns all state (meds, times, dateKey) and persistence.
//   - Presentational components (MedViewCard, MedEditCard, TimeEditModal)
//     receive data + callbacks and render one thing each.
//   - All saved data is sanitized on load so a corrupted or partial
//     record can never crash the app.
//   - The daily reset fires three ways: on app wake, on a 30-second
//     interval (covers the app sitting open past midnight), and as a
//     guard inside addDose.
// =====================================================================

// ---- Constants -------------------------------------------------------

const PALETTE = ['#1F496A', '#6B5E3F', '#1B5E20', '#14306B', '#99114A',
                 '#00565E', '#4A148C', '#A03000', '#004D40', '#880E4F'];

const DEFAULT_MEDS = [
  { id: 'vital',   name: 'Vital Tears',     detail: '1 drop, each eye', target: 8, color: '#1F496A' },
  { id: 'systane', name: 'Systane',         detail: '1 drop, each eye', target: 4, color: '#1B5E20' },
  { id: 'blue',    name: 'Dark Blue',       detail: '1 drop, each eye', target: 2, color: '#14306B' },
  { id: 'pink',    name: 'Pink',            detail: '1 drop',           target: 2, color: '#99114A' },
  { id: 'lotemax', name: 'Lotemax Ointment',detail: 'Each eye',         target: 2, color: '#6B5E3F' },
];

const MED_LIBRARY = [
  { name: 'Systane', detail: '1 drop, each eye' },
  { name: 'Systane Ultra', detail: '1 drop, each eye' },
  { name: 'Systane Complete', detail: '1 drop, each eye' },
  { name: 'Refresh Tears', detail: '1 drop, each eye' },
  { name: 'Refresh Optive', detail: '1 drop, each eye' },
  { name: 'Vital Tears', detail: '1 drop, each eye' },
  { name: 'TheraTears', detail: '1 drop, each eye' },
  { name: 'Blink Tears', detail: '1 drop, each eye' },
  { name: 'GenTeal', detail: '1 drop, each eye' },
  { name: 'Xiidra', detail: '1 drop, each eye' },
  { name: 'Restasis', detail: '1 drop, each eye' },
  { name: 'Cequa', detail: '1 drop, each eye' },
  { name: 'Miebo', detail: '1 drop, each eye' },
  { name: 'Latanoprost', detail: '1 drop, each eye' },
  { name: 'Xalatan', detail: '1 drop, each eye' },
  { name: 'Timolol', detail: '1 drop, each eye' },
  { name: 'Timoptic', detail: '1 drop, each eye' },
  { name: 'Cosopt', detail: '1 drop, each eye' },
  { name: 'Combigan', detail: '1 drop, each eye' },
  { name: 'Alphagan', detail: '1 drop, each eye' },
  { name: 'Lumigan', detail: '1 drop, each eye' },
  { name: 'Travatan Z', detail: '1 drop, each eye' },
  { name: 'Rocklatan', detail: '1 drop, each eye' },
  { name: 'Rhopressa', detail: '1 drop, each eye' },
  { name: 'Vyzulta', detail: '1 drop, each eye' },
  { name: 'Zioptan', detail: '1 drop, each eye' },
  { name: 'Trusopt', detail: '1 drop, each eye' },
  { name: 'Azopt', detail: '1 drop, each eye' },
  { name: 'Simbrinza', detail: '1 drop, each eye' },
  { name: 'Prednisolone', detail: '1 drop, each eye' },
  { name: 'Pred Forte', detail: '1 drop, each eye' },
  { name: 'Lotemax', detail: '1 drop, each eye' },
  { name: 'Lotemax Ointment', detail: 'Each eye' },
  { name: 'Durezol', detail: '1 drop, each eye' },
  { name: 'Flarex', detail: '1 drop, each eye' },
  { name: 'Maxidex', detail: '1 drop, each eye' },
  { name: 'Dexamethasone', detail: '1 drop, each eye' },
  { name: 'Fluorometholone', detail: '1 drop, each eye' },
  { name: 'Ketorolac', detail: '1 drop, each eye' },
  { name: 'Acuvail', detail: '1 drop, each eye' },
  { name: 'Bromday', detail: '1 drop, each eye' },
  { name: 'Prolensa', detail: '1 drop, each eye' },
  { name: 'Ilevro', detail: '1 drop, each eye' },
  { name: 'Nevanac', detail: '1 drop, each eye' },
  { name: 'Diclofenac', detail: '1 drop, each eye' },
  { name: 'Vigamox', detail: '1 drop, each eye' },
  { name: 'Moxifloxacin', detail: '1 drop, each eye' },
  { name: 'Ciprofloxacin', detail: '1 drop, each eye' },
  { name: 'Ofloxacin', detail: '1 drop, each eye' },
  { name: 'Besivance', detail: '1 drop, each eye' },
  { name: 'Zymaxid', detail: '1 drop, each eye' },
  { name: 'Tobradex', detail: '1 drop, each eye' },
  { name: 'Tobramycin', detail: '1 drop, each eye' },
  { name: 'Erythromycin Ointment', detail: 'Each eye' },
  { name: 'Pataday', detail: '1 drop, each eye' },
  { name: 'Patanol', detail: '1 drop, each eye' },
  { name: 'Zaditor', detail: '1 drop, each eye' },
  { name: 'Alaway', detail: '1 drop, each eye' },
  { name: 'Optivar', detail: '1 drop, each eye' },
  { name: 'Bepreve', detail: '1 drop, each eye' },
  { name: 'Lastacaft', detail: '1 drop, each eye' },
  { name: 'Cyclopentolate', detail: '1 drop, each eye' },
  { name: 'Atropine', detail: '1 drop, each eye' },
  { name: 'Phenylephrine', detail: '1 drop, each eye' },
  { name: 'Tropicamide', detail: '1 drop, each eye' },
];

const LIGHT_THEME = {
  bg:            '#C5D7D3',   // sage page background
  card:          '#FFFFFF',
  ink:           '#17334A',   // primary text (9.9:1 on white)
  inkSoft:       '#5A7185',   // secondary text (5.4:1 on white)
  inkMuted:      '#8AA0B0',   // hints, disabled
  cream:         '#F4F1EA',   // secondary button fills
  hairline:      'rgba(23,51,74,0.15)',  // card borders
  divider:       '#E8ECEF',   // progress-bar track, dividers
  done:          '#1B5E20',
  danger:        '#A50000',
  overlay:       'rgba(23,51,74,0.55)',  // modal backdrop
  frameBorder:   '#17334A',
};

const DARK_THEME = {
  bg:            '#0F1620',
  card:          '#1B2635',
  ink:           '#F2F2ED',
  inkSoft:       '#8FA4B8',
  inkMuted:      '#5A7185',
  cream:         '#2A3B52',
  hairline:      'rgba(255,255,255,0.10)',
  divider:       '#2A3B52',
  done:          '#7FBB6E',
  danger:        '#F08080',
  overlay:       'rgba(0,0,0,0.7)',
  frameBorder:   '#0A0E14',
};

// Palette entries used by medication color swatches. Keep the SAME
// ten hex values in both modes — the medication color is the user's
// identifier for the med and shouldn't shift on theme switch. The
// existing DEFAULT_MEDS colors already come from this list.

const STORAGE_KEY = 'eyedrop-tracker-v3';
const TRIAL_START_KEY = 'eyetally_trial_start';
const FULL_UNLOCK_KEY = 'eyetally_full_unlock';
const TRIAL_MIGRATION_KEY = 'eyetally_migration_v1_5_complete';
const FULL_UNLOCK_SKU = 'com.mulcahy.itally.fullunlock';
const REMINDER_CATEGORY_ID = 'eyetally_dose_reminder';
const REMINDER_MARK_TAKEN_ACTION_ID = 'eyetally_mark_taken';
const REMINDER_NOTIFICATION_TYPE = 'eyetally-dose-reminder';
const REMINDER_CHANNEL_ID = 'eyetally-reminders';
const MIN_TARGET = 1;
const MAX_TARGET = 24;
const DAY_MS = 24 * 60 * 60 * 1000;
const TRIAL_LENGTH_MS = 3 * DAY_MS;
const DAY_CHECK_MS = 30 * 1000;   // how often to check for midnight rollover
const TRIAL_CHECK_MS = 60 * 1000;  // how often to re-check trial expiry while open
const SAVE_DEBOUNCE_MS = 400;     // batch rapid changes (typing) into one write
const CONFIRM_RESET_MS = 5000;    // auto-disarm a pending delete confirmation

// ---- Pure helpers ----------------------------------------------------

function todayString() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function emptyTimes(meds) {
  const t = {};
  meds.forEach((m) => (t[m.id] = []));
  return t;
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function clampTarget(n) {
  return Math.max(MIN_TARGET, Math.min(MAX_TARGET, Math.round(n)));
}

function clampHour(n) {
  const h = Math.round(Number(n));
  if (!Number.isFinite(h)) return 9;
  return ((h % 24) + 24) % 24;
}

function clampMinute(n) {
  const m = Math.round(Number(n));
  if (!Number.isFinite(m)) return 0;
  return Math.max(0, Math.min(59, m));
}

function sanitizeReminders(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === 'object')
    .map((r, i) => ({
      id: typeof r.id === 'string' && r.id.length > 0
        ? r.id
        : `reminder-${Date.now()}-${i}`,
      hour: clampHour(r.hour),
      minute: clampMinute(r.minute),
      notificationId:
        typeof r.notificationId === 'string' && r.notificationId.length > 0
          ? r.notificationId
          : null,
    }));
}

function formatReminderTime(reminder) {
  const d = new Date();
  d.setHours(clampHour(reminder.hour), clampMinute(reminder.minute), 0, 0);
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function makeReminderFromDate(date = new Date()) {
  const d = new Date(date);
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return {
    id: `reminder-${Date.now()}`,
    hour: d.getHours(),
    minute: d.getMinutes(),
    notificationId: null,
  };
}

function isStorePlatform() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function ownsFullUnlock(purchase) {
  if (!purchase || typeof purchase !== 'object') return false;
  if (purchase.productId === FULL_UNLOCK_SKU) return true;
  return Array.isArray(purchase.ids) && purchase.ids.includes(FULL_UNLOCK_SKU);
}

function verifyFullUnlockReceipt(purchase) {
  if (!ownsFullUnlock(purchase)) return false;
  if (purchase.purchaseState === 'pending') return false;
  return Boolean(purchase.id || purchase.transactionId || purchase.purchaseToken);
}

function friendlyPurchaseError(error, fallback) {
  const message = typeof error?.message === 'string' ? error.message : '';
  if (message.toLowerCase().includes('cancel')) return 'Purchase cancelled.';
  return message || fallback;
}

async function hasPreExistingAppData(storage = AsyncStorage) {
  const raw = await storage.getItem(STORAGE_KEY);
  if (!raw) return false;

  try {
    const saved = JSON.parse(raw);
    return Boolean(
      sanitizeMeds(saved?.meds) ||
      saved?.date ||
      saved?.theme === 'dark' ||
      saved?.theme === 'light' ||
      Object.values(saved?.times || {}).some(
        (arr) => Array.isArray(arr) && arr.length > 0
      )
    );
  } catch (e) {
    return true;
  }
}

async function getTrialStatus(now = Date.now(), storage = AsyncStorage) {
  let rawStart = await storage.getItem(TRIAL_START_KEY);
  let trialStart = Number(rawStart);

  if (!rawStart || !Number.isFinite(trialStart) || trialStart <= 0) {
    trialStart = now;
    await storage.setItem(TRIAL_START_KEY, String(trialStart));
  }

  const msRemaining = trialStart + TRIAL_LENGTH_MS - now;
  return {
    isTrialActive: msRemaining > 0,
    daysRemaining: Math.max(0, Math.ceil(msRemaining / DAY_MS)),
  };
}

async function getStoredFullUnlock(storage = AsyncStorage) {
  return (await storage.getItem(FULL_UNLOCK_KEY)) === 'true';
}

async function storeFullUnlock(value, storage = AsyncStorage) {
  await storage.setItem(FULL_UNLOCK_KEY, value ? 'true' : 'false');
}

async function initializeAccessState(now = Date.now(), storage = AsyncStorage) {
  const purchased = await getStoredFullUnlock(storage);
  const migrationComplete = (await storage.getItem(TRIAL_MIGRATION_KEY)) === 'true';

  if (purchased) {
    if (!migrationComplete) {
      await storage.setItem(TRIAL_MIGRATION_KEY, 'true');
    }
    return {
      hasPurchasedFullUnlock: true,
      trialStatus: { isTrialActive: false, daysRemaining: 0 },
    };
  }

  const rawTrialStart = await storage.getItem(TRIAL_START_KEY);

  if (!migrationComplete) {
    if (!rawTrialStart && (await hasPreExistingAppData(storage))) {
      await storeFullUnlock(true, storage);
      await storage.setItem(TRIAL_MIGRATION_KEY, 'true');
      return {
        hasPurchasedFullUnlock: true,
        trialStatus: { isTrialActive: false, daysRemaining: 0 },
      };
    }

    await storage.setItem(TRIAL_MIGRATION_KEY, 'true');
  }

  return {
    hasPurchasedFullUnlock: false,
    trialStatus: await getTrialStatus(now, storage),
  };
}

async function purchaseFullUnlock() {
  if (!isStorePlatform()) {
    throw new Error('Purchases are available only in the iOS or Android app.');
  }

  await requestPurchase({
    request: {
      apple: { sku: FULL_UNLOCK_SKU },
      google: { skus: [FULL_UNLOCK_SKU] },
    },
    type: 'in-app',
  });
}

function notificationsAllowed(settings) {
  return Boolean(
    settings?.granted ||
    settings?.status === 'granted' ||
    settings?.ios?.status === Notifications.IosAuthorizationStatus?.AUTHORIZED ||
    settings?.ios?.status === Notifications.IosAuthorizationStatus?.PROVISIONAL ||
    settings?.ios?.status === Notifications.IosAuthorizationStatus?.EPHEMERAL
  );
}

function notificationsDenied(settings) {
  return Boolean(
    settings?.status === 'denied' ||
    settings?.ios?.status === Notifications.IosAuthorizationStatus?.DENIED
  );
}

async function setupReminderNotificationsAsync() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: 'EyeTally reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  await Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY_ID, [
    {
      identifier: REMINDER_MARK_TAKEN_ACTION_ID,
      buttonTitle: 'Mark as Taken',
      options: {
        opensAppToForeground: false,
      },
    },
  ]);
}

async function getReminderPermissionStatus() {
  try {
    return await Notifications.getPermissionsAsync();
  } catch (e) {
    return { status: 'denied', granted: false };
  }
}

async function scheduleDoseReminder(med, reminder) {
  await setupReminderNotificationsAsync();
  return await Notifications.scheduleNotificationAsync({
    content: {
      title: med.name ? `Time for ${med.name}` : 'EyeTally reminder',
      body: med.detail || 'Time for your eye drops.',
      categoryIdentifier: REMINDER_CATEGORY_ID,
      data: {
        type: REMINDER_NOTIFICATION_TYPE,
        medId: med.id,
        reminderId: reminder.id,
      },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: clampHour(reminder.hour),
      minute: clampMinute(reminder.minute),
      channelId: REMINDER_CHANNEL_ID,
    },
  });
}

async function cancelReminderNotification(reminder) {
  if (!reminder?.notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(reminder.notificationId);
  } catch (e) {}
}

async function cancelMedicationReminderNotifications(med) {
  const reminders = sanitizeReminders(med?.reminders);
  await Promise.all(reminders.map(cancelReminderNotification));
}

async function isMedicationDoneToday(medId, storage = AsyncStorage) {
  try {
    const raw = await storage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    const meds = sanitizeMeds(saved.meds) || DEFAULT_MEDS;
    const med = meds.find((m) => m.id === medId);
    if (!med || saved.date !== todayString()) return false;
    const times = sanitizeTimes(saved.times, meds);
    return (times[medId] || []).length >= med.target;
  } catch (e) {
    return false;
  }
}

async function logDoseInStoredData(medId, storage = AsyncStorage) {
  const raw = await storage.getItem(STORAGE_KEY);
  const saved = raw ? JSON.parse(raw) : {};
  const meds = sanitizeMeds(saved.meds) || DEFAULT_MEDS;
  const med = meds.find((m) => m.id === medId);
  if (!med) {
    return { logged: false, reason: 'missing' };
  }

  const date = todayString();
  const times =
    saved.date === date
      ? sanitizeTimes(saved.times, meds)
      : emptyTimes(meds);
  const arr = times[medId] || [];

  if (arr.length >= med.target) {
    return { logged: false, reason: 'done', date, meds, times, medName: med.name };
  }

  const nextTimes = {
    ...times,
    [medId]: [...arr, new Date().toISOString()].sort(),
  };
  const nextSaved = {
    date,
    meds,
    times: nextTimes,
  };
  if (saved.theme === 'dark' || saved.theme === 'light') {
    nextSaved.theme = saved.theme;
  }

  await storage.setItem(STORAGE_KEY, JSON.stringify(nextSaved));
  return { logged: true, date, meds, times: nextTimes, medName: med.name };
}

// Expo can only run this suppression check when JS is active.
// Background iOS local notifications may still show if the dose was already met.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification?.request?.content?.data || {};
    const shouldSuppress =
      data.type === REMINDER_NOTIFICATION_TYPE &&
      data.medId &&
      (await isMedicationDoneToday(data.medId));

    return {
      shouldShowBanner: !shouldSuppress,
      shouldShowList: !shouldSuppress,
      shouldPlaySound: !shouldSuppress,
      shouldSetBadge: false,
    };
  },
});

// Turn a medication name into its Siri link word:
// "Vital Tears" -> "vital-tears". Matches incoming eyetally://log/ URLs.
function slugify(name) {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Return up to 5 library entries whose name starts with the typed query
// (case-insensitive). Empty query returns nothing.
function librarySuggestions(query) {
  const q = (query || '').trim().toLowerCase();
  if (q.length < 1) return [];
  return MED_LIBRARY
    .filter((m) => m.name.toLowerCase().startsWith(q))
    .slice(0, 5);
}

// Validate stored medications; returns null if nothing usable survives,
// so the caller can fall back to defaults.
function sanitizeMeds(raw) {
  if (!Array.isArray(raw)) return null;
  const cleaned = raw
    .filter((m) => m && typeof m === 'object' && typeof m.id === 'string' && m.id.length > 0)
    .map((m, i) => ({
      id: m.id,
      name: typeof m.name === 'string' ? m.name : '',
      detail: typeof m.detail === 'string' ? m.detail : '',
      target: Number.isFinite(m.target) ? clampTarget(m.target) : 1,
      color: typeof m.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(m.color)
        ? m.color
        : PALETTE[i % PALETTE.length],
      reminders: sanitizeReminders(m.reminders),
    }));
  return cleaned.length > 0 ? cleaned : null;
}

// Validate stored dose times: keep only parseable ISO strings, sorted.
function sanitizeTimes(raw, meds) {
  const t = emptyTimes(meds);
  if (raw && typeof raw === 'object') {
    meds.forEach((m) => {
      const arr = raw[m.id];
      if (Array.isArray(arr)) {
        t[m.id] = arr
          .filter((x) => typeof x === 'string' && !Number.isNaN(Date.parse(x)))
          .sort();
      }
    });
  }
  return t;
}

// ---- Presentational components ---------------------------------------

function Progress({ done, target, color, theme }) {
  return (
    <View style={{
      flexDirection: 'row', flexWrap: 'wrap',
      marginTop: 12, marginLeft: 24,
    }}>
      {Array.from({ length: target }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 18, height: 18, borderRadius: 9, borderWidth: 2,
            borderColor: i < done ? color : theme.inkMuted,
            backgroundColor: i < done ? color : 'transparent',
            marginRight: 8, marginBottom: 6,
          }}
        />
      ))}
    </View>
  );
}

function MedViewCard({
  med,
  doseTimes,
  onAddDose,
  onUndo,
  onEditTime,
  styles,
  theme,
  expanded,
  onToggleExpand,
}) {
  const done = doseTimes.length;
  const finished = done >= med.target;
  const effectiveExpanded = expanded;
  return (
    <Pressable
      onPress={onToggleExpand}
      style={({ pressed }) => [
        styles.card,
        finished && styles.cardFinished,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardText}>
          <View style={styles.nameRow}>
            <View style={[styles.capDot, { backgroundColor: med.color }]} />
            <Text
              style={styles.medName}
              numberOfLines={2}
              adjustsFontSizeToFit
            >
              {med.name || 'Unnamed medication'}
            </Text>
          </View>
          <Text
            style={[styles.medCount, finished && styles.medCountDone]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {finished ? (
              '✓ DONE FOR TODAY'
            ) : (
              <>
                {done}
                <Text style={{ color: theme.inkSoft, fontWeight: '400' }}>
                  {` of ${med.target} today`}
                </Text>
              </>
            )}
          </Text>
          {!effectiveExpanded && !finished && doseTimes.length > 0 && (
            <Text
              style={styles.lastTaken}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              Last taken at {formatTime(doseTimes[doseTimes.length - 1])}
            </Text>
          )}
          {effectiveExpanded && med.detail ? (
            <Text style={styles.medDetail} numberOfLines={2}>{med.detail}</Text>
          ) : null}
          {(!finished || effectiveExpanded) && (
            <Progress done={done} target={med.target} color={med.color} theme={theme} />
          )}
        </View>
        <View style={styles.buttons}>
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onAddDose(med.id);
            }}
            disabled={finished}
            style={({ pressed }) => [
              styles.plusBtn,
              { backgroundColor: finished ? theme.divider : med.color },
              finished && { borderColor: theme.inkSoft },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[styles.plusText, finished && { color: theme.inkSoft }]}
              allowFontScaling={false}
            >
              {finished ? '✓' : '+1'}
            </Text>
          </Pressable>
          {done > 0 && effectiveExpanded && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                onUndo(med.id);
              }}
              style={({ pressed }) => [styles.minusBtn, pressed && styles.pressed]}
            >
              <Text style={styles.minusText}>undo</Text>
            </Pressable>
          )}
        </View>
      </View>

      {effectiveExpanded && doseTimes.length > 0 && (
        <View style={styles.timeRow}>
          {doseTimes.map((iso, i) => (
            <Pressable
              key={`${iso}-${i}`}
              onPress={(e) => {
                e.stopPropagation?.();
                onEditTime(med.id, i);
              }}
              style={({ pressed }) => [styles.timeChip, pressed && styles.pressed]}
            >
              <Text style={styles.timeChipText} allowFontScaling={false}>
                {formatTime(iso)} ✎
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </Pressable>
  );
}

function MedEditCard({
  med,
  confirming,
  onUpdate,
  onBumpTarget,
  onDelete,
  onAddReminder,
  onEditReminder,
  onDeleteReminder,
  styles,
  theme,
}) {
  const [focused, setFocused] = useState(false);
  const suggestions = librarySuggestions(med.name);
  const exactLibraryMatch = MED_LIBRARY.some((m) => m.name === med.name);
  const reminders = sanitizeReminders(med.reminders);

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardText}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.capDot, { backgroundColor: med.color }]} />
            <TextInput
              style={[styles.nameInput, { flex: 1 }]}
              value={med.name}
              placeholder="Medication name"
              placeholderTextColor={theme.inkSoft}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              onChangeText={(t) => onUpdate(med.id, { name: t })}
            />
          </View>
          {focused && med.name.trim().length > 0 && !exactLibraryMatch && suggestions.length > 0 && (
            <View style={styles.suggestionList}>
              {suggestions.map((suggestion, i) => (
                <Pressable
                  key={suggestion.name}
                  onPress={() => {
                    onUpdate(med.id, { name: suggestion.name, detail: suggestion.detail });
                    setFocused(false);
                  }}
                  style={({ pressed }) => [
                    styles.suggestionItem,
                    i === suggestions.length - 1 && { borderBottomWidth: 0 },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.suggestionText}>{suggestion.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <TextInput
            style={styles.detailInput}
            value={med.detail}
            placeholder="Instructions (e.g., 1 drop, each eye)"
            placeholderTextColor={theme.inkSoft}
            onChangeText={(t) => onUpdate(med.id, { detail: t })}
          />
          <View style={styles.targetRow}>
            <Text style={styles.targetLabel}>Times per day:</Text>
            <Pressable
              onPress={() => onBumpTarget(med.id, -1)}
              style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
            >
              <Text style={styles.stepBtnText} allowFontScaling={false}>−</Text>
            </Pressable>
            <Text style={styles.targetValue} allowFontScaling={false}>{med.target}</Text>
            <Pressable
              onPress={() => onBumpTarget(med.id, 1)}
              style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
            >
              <Text style={styles.stepBtnText} allowFontScaling={false}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.colorLabel}>Color:</Text>
          <View style={styles.colorRow}>
            {PALETTE.map((c) => (
              <Pressable
                key={c}
                onPress={() => onUpdate(med.id, { color: c })}
                style={({ pressed }) => [
                  styles.colorSwatch,
                  { backgroundColor: c },
                  med.color === c && styles.colorSwatchSelected,
                  pressed && styles.pressed,
                ]}
              >
                {med.color === c && (
                  <Text style={styles.colorCheck} allowFontScaling={false}>✓</Text>
                )}
              </Pressable>
            ))}
          </View>
          <View style={styles.remindersSection}>
            <Text style={styles.remindersTitle}>Reminders</Text>
            {reminders.length > 0 && reminders.map((reminder) => (
              <View key={reminder.id} style={styles.reminderRow}>
                <Pressable
                  onPress={() => onEditReminder(med.id, reminder.id)}
                  style={({ pressed }) => [styles.reminderTimeBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.reminderTimeText}>
                    {formatReminderTime(reminder)}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => onDeleteReminder(med.id, reminder.id)}
                  style={({ pressed }) => [styles.reminderRemoveBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.reminderRemoveText}>Remove</Text>
                </Pressable>
              </View>
            ))}
            <Pressable
              onPress={() => onAddReminder(med.id)}
              style={({ pressed }) => [styles.addReminderBtn, pressed && styles.pressed]}
            >
              <Text style={styles.addReminderText}>Add Reminder Time</Text>
            </Pressable>
          </View>
        </View>
      </View>
      <Pressable
        onPress={() => onDelete(med.id)}
        style={({ pressed }) => [
          styles.deleteBtn,
          confirming && styles.deleteBtnConfirm,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.deleteBtnText, confirming && { color: theme.card }]}>
          {confirming ? 'Tap again to delete permanently' : 'Delete this medication'}
        </Text>
      </Pressable>
    </View>
  );
}

function TimeEditModal({ editing, medName, onBump, onSave, onDelete, onCancel, styles }) {
  return (
    <Modal visible={!!editing} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{medName} — dose time</Text>
          {editing && (
            <View style={styles.pickerRow}>
              <View style={styles.pickerCol}>
                <Pressable onPress={() => onBump('hour', 1)} style={styles.pickBtn}>
                  <Text style={styles.pickBtnText}>▲</Text>
                </Pressable>
                <Text style={styles.pickValue}>{editing.hour}</Text>
                <Pressable onPress={() => onBump('hour', -1)} style={styles.pickBtn}>
                  <Text style={styles.pickBtnText}>▼</Text>
                </Pressable>
              </View>
              <Text style={styles.pickColon}>:</Text>
              <View style={styles.pickerCol}>
                <Pressable onPress={() => onBump('minute', 5)} style={styles.pickBtn}>
                  <Text style={styles.pickBtnText}>▲</Text>
                </Pressable>
                <Text style={styles.pickValue}>
                  {String(editing.minute).padStart(2, '0')}
                </Text>
                <Pressable onPress={() => onBump('minute', -5)} style={styles.pickBtn}>
                  <Text style={styles.pickBtnText}>▼</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={() => onBump('am')}
                style={({ pressed }) => [styles.ampmBtn, pressed && styles.pressed]}
              >
                <Text style={styles.ampmText}>{editing.am ? 'AM' : 'PM'}</Text>
              </Pressable>
            </View>
          )}
          <Pressable
            onPress={onSave}
            style={({ pressed }) => [styles.modalSave, pressed && styles.pressed]}
          >
            <Text style={styles.modalSaveText}>Save time</Text>
          </Pressable>
          <Pressable
            onPress={onDelete}
            style={({ pressed }) => [styles.modalDelete, pressed && styles.pressed]}
          >
            <Text style={styles.modalDeleteText}>Remove this dose</Text>
          </Pressable>
          <Pressable
            onPress={onCancel}
            style={({ pressed }) => [styles.modalCancel, pressed && styles.pressed]}
          >
            <Text style={styles.modalCancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function ReminderTimeModal({ editing, medName, onBump, onSave, onCancel, styles }) {
  return (
    <Modal visible={!!editing} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{medName} reminder</Text>
          {editing && (
            <View style={styles.pickerRow}>
              <View style={styles.pickerCol}>
                <Pressable onPress={() => onBump('hour', 1)} style={styles.pickBtn}>
                  <Text style={styles.pickBtnText}>▲</Text>
                </Pressable>
                <Text style={styles.pickValue}>{editing.hour}</Text>
                <Pressable onPress={() => onBump('hour', -1)} style={styles.pickBtn}>
                  <Text style={styles.pickBtnText}>▼</Text>
                </Pressable>
              </View>
              <Text style={styles.pickColon}>:</Text>
              <View style={styles.pickerCol}>
                <Pressable onPress={() => onBump('minute', 5)} style={styles.pickBtn}>
                  <Text style={styles.pickBtnText}>▲</Text>
                </Pressable>
                <Text style={styles.pickValue}>
                  {String(editing.minute).padStart(2, '0')}
                </Text>
                <Pressable onPress={() => onBump('minute', -5)} style={styles.pickBtn}>
                  <Text style={styles.pickBtnText}>▼</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={() => onBump('am')}
                style={({ pressed }) => [styles.ampmBtn, pressed && styles.pressed]}
              >
                <Text style={styles.ampmText}>{editing.am ? 'AM' : 'PM'}</Text>
              </Pressable>
            </View>
          )}
          <Pressable
            onPress={onSave}
            style={({ pressed }) => [styles.modalSave, pressed && styles.pressed]}
          >
            <Text style={styles.modalSaveText}>Save reminder</Text>
          </Pressable>
          <Pressable
            onPress={onCancel}
            style={({ pressed }) => [styles.modalCancel, pressed && styles.pressed]}
          >
            <Text style={styles.modalCancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function PaywallScreen({
  styles,
  themeName,
  onPurchase,
  onRestore,
  purchaseBusy,
  restoreBusy,
  error,
}) {
  const busy = purchaseBusy || restoreBusy;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={themeName === 'dark' ? 'light-content' : 'dark-content'} />
      <View style={styles.paywallWrap}>
        <View style={styles.paywallCard}>
          <Text style={styles.paywallEyebrow}>EyeTally</Text>
          <Text style={styles.paywallTitle}>
            Your 3-day free trial has ended.
          </Text>
          <Text style={styles.paywallBody}>
            Unlock EyeTally to keep tracking your eye drops.
          </Text>

          {error ? <Text style={styles.paywallError}>{error}</Text> : null}

          <Pressable
            onPress={onPurchase}
            disabled={busy}
            style={({ pressed }) => [
              styles.paywallButton,
              busy && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.paywallButtonText}>
              {purchaseBusy ? 'Starting purchase...' : 'Unlock for $2.99'}
            </Text>
          </Pressable>

          <Pressable
            onPress={onRestore}
            disabled={busy}
            style={({ pressed }) => [
              styles.restoreLink,
              busy && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.restoreLinkText}>
              {restoreBusy ? 'Restoring...' : 'Restore Purchase'}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ---- App --------------------------------------------------------------

export default function App() {
  const [meds, setMeds] = useState(DEFAULT_MEDS);
  const [times, setTimes] = useState(() => emptyTimes(DEFAULT_MEDS));
  const [dateKey, setDateKey] = useState(todayString());
  const [editMode, setEditMode] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(null);
  const [editingTime, setEditingTime] = useState(null);
  const [editingReminder, setEditingReminder] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState(null);
  const [banner, setBanner] = useState(null);
  const [themeName, setThemeName] = useState('light');
  const [accessLoaded, setAccessLoaded] = useState(false);
  const [trialStatus, setTrialStatus] = useState({
    isTrialActive: false,
    daysRemaining: 0,
  });
  const [hasPurchasedFullUnlock, setHasPurchasedFullUnlock] = useState(false);
  const [initialRestoreChecked, setInitialRestoreChecked] = useState(!isStorePlatform());
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [paywallError, setPaywallError] = useState(null);
  const theme = themeName === 'dark' ? DARK_THEME : LIGHT_THEME;
  const styles = React.useMemo(() => makeStyles(theme), [theme]);

  const markFullUnlockPurchased = useCallback(async () => {
    await storeFullUnlock(true);
    setHasPurchasedFullUnlock(true);
    setPaywallError(null);
  }, []);

  const refreshTrialState = useCallback(async () => {
    const status = await getTrialStatus();
    setTrialStatus(status);
    return status;
  }, []);

  const restorePurchases = useCallback(async () => {
    if (!isStorePlatform()) {
      throw new Error('Restore is available only in the iOS or Android app.');
    }

    const purchases = await getAvailablePurchases();
    const fullUnlock = purchases.find(ownsFullUnlock);
    if (!fullUnlock || !verifyFullUnlockReceipt(fullUnlock)) return false;

    await markFullUnlockPurchased();
    return true;
  }, [markFullUnlockPurchased]);

  const handlePurchaseFullUnlock = useCallback(async () => {
    setPaywallError(null);
    setPurchaseBusy(true);
    try {
      await purchaseFullUnlock();
    } catch (error) {
      setPaywallError(
        friendlyPurchaseError(error, 'Unable to start purchase. Please try again.')
      );
    } finally {
      setPurchaseBusy(false);
    }
  }, []);

  const handleRestorePurchases = useCallback(async () => {
    setPaywallError(null);
    setRestoreBusy(true);
    try {
      const restored = await restorePurchases();
      if (!restored) {
        setPaywallError('No previous EyeTally unlock was found.');
      }
    } catch (error) {
      setPaywallError(
        friendlyPurchaseError(error, 'Unable to restore purchase. Please try again.')
      );
    } finally {
      setRestoreBusy(false);
    }
  }, [restorePurchases]);

  const copySiriLink = async (med) => {
    const url = `eyetally://log/${slugify(med.name)}`;
    await Clipboard.setStringAsync(url);
    setCopiedSlug(slugify(med.name));
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  // Refs mirror state so long-lived callbacks (interval, AppState,
  // debounced save) always see current values without re-subscribing.
  const medsRef = useRef(meds);
  const timesRef = useRef(times);
  const dateKeyRef = useRef(dateKey);
  const loadedRef = useRef(loaded);
  const handledNotificationResponsesRef = useRef(new Set());
  useEffect(() => { medsRef.current = meds; }, [meds]);
  useEffect(() => { timesRef.current = times; }, [times]);
  useEffect(() => { dateKeyRef.current = dateKey; }, [dateKey]);
  useEffect(() => { loadedRef.current = loaded; }, [loaded]);

  const showNotificationSettingsMessage = useCallback(() => {
    setBanner('Notifications are off. Enable them in iOS Settings to use reminders.');
  }, []);

  const ensureReminderPermission = useCallback(async () => {
    await setupReminderNotificationsAsync();
    const existing = await getReminderPermissionStatus();
    if (notificationsAllowed(existing)) return true;
    if (notificationsDenied(existing)) {
      showNotificationSettingsMessage();
      return false;
    }

    const requested = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowSound: true,
        allowBadge: false,
      },
    });

    if (notificationsAllowed(requested)) return true;
    showNotificationSettingsMessage();
    return false;
  }, [showNotificationSettingsMessage]);

  // ---- Trial / purchase access ----
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { trialStatus: status, hasPurchasedFullUnlock: purchased } =
          await initializeAccessState();
        if (!alive) return;
        setTrialStatus(status);
        setHasPurchasedFullUnlock(purchased);
      } catch (e) {
        if (!alive) return;
        setTrialStatus({ isTrialActive: true, daysRemaining: 3 });
        setHasPurchasedFullUnlock(false);
      } finally {
        if (alive) setAccessLoaded(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (hasPurchasedFullUnlock) return undefined;
    const id = setInterval(() => {
      refreshTrialState().catch(() => {});
    }, TRIAL_CHECK_MS);
    return () => clearInterval(id);
  }, [hasPurchasedFullUnlock, refreshTrialState]);

  useEffect(() => {
    if (!isStorePlatform()) return undefined;
    let alive = true;

    const purchaseSub = purchaseUpdatedListener(async (purchase) => {
      if (!verifyFullUnlockReceipt(purchase)) return;
      setPurchaseBusy(true);
      try {
        await markFullUnlockPurchased();
        await finishTransaction({ purchase, isConsumable: false });
      } catch (error) {
        if (alive) {
          setPaywallError(
            friendlyPurchaseError(error, 'Purchase completed, but finalization failed.')
          );
        }
      } finally {
        if (alive) setPurchaseBusy(false);
      }
    });

    const errorSub = purchaseErrorListener((error) => {
      if (!alive) return;
      setPurchaseBusy(false);
      setPaywallError(
        friendlyPurchaseError(error, 'Purchase failed. Please try again.')
      );
    });

    (async () => {
      try {
        await initConnection();
        if (alive) await restorePurchases();
      } catch (error) {
        if (alive) {
          setPaywallError(
            friendlyPurchaseError(error, 'Purchases are unavailable right now.')
          );
        }
      } finally {
        if (alive) setInitialRestoreChecked(true);
      }
    })();

    return () => {
      alive = false;
      purchaseSub.remove();
      errorSub.remove();
      endConnection().catch(() => {});
    };
  }, [markFullUnlockPurchased, restorePurchases]);

  // ---- Load once on start ----
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          const savedMeds = sanitizeMeds(saved.meds) || DEFAULT_MEDS;
          if (saved.theme === 'dark' || saved.theme === 'light') {
            setThemeName(saved.theme);
          }
          setMeds(savedMeds);
          setTimes(
            saved.date === todayString()
              ? sanitizeTimes(saved.times, savedMeds)
              : emptyTimes(savedMeds)
          );
        }
      } catch (e) {
        // Unreadable storage: start clean rather than crash.
      }
      setDateKey(todayString());
      setLoaded(true);
    })();
  }, []);

  // ---- Save (debounced) ----
  const saveTimer = useRef(null);
  const saveNow = useCallback(() => {
    if (!loadedRef.current) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        date: dateKeyRef.current,
        meds: medsRef.current,
        times: timesRef.current,
        theme: themeName,
      })
    ).catch(() => {});
  }, [themeName]);

  useEffect(() => {
    if (!loaded) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveNow, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(saveTimer.current);
  }, [meds, times, dateKey, themeName, loaded, saveNow]);

  const reconcileReminderSchedules = useCallback(async () => {
    const permission = await getReminderPermissionStatus();
    if (!notificationsAllowed(permission)) return;

    await setupReminderNotificationsAsync();
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const scheduledIds = new Set(scheduled.map((n) => n.identifier));
    const currentMeds = medsRef.current;
    let changed = false;

    const nextMeds = await Promise.all(
      currentMeds.map(async (med) => {
        const reminders = sanitizeReminders(med.reminders);
        if (reminders.length === 0) return { ...med, reminders };

        const nextReminders = [];
        for (const reminder of reminders) {
          if (reminder.notificationId && scheduledIds.has(reminder.notificationId)) {
            nextReminders.push(reminder);
          } else {
            try {
              const notificationId = await scheduleDoseReminder(med, reminder);
              nextReminders.push({ ...reminder, notificationId });
              changed = true;
            } catch (e) {
              nextReminders.push(reminder);
            }
          }
        }
        return { ...med, reminders: nextReminders };
      })
    );

    if (changed) setMeds(nextMeds);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    reconcileReminderSchedules().catch(() => {});
  }, [loaded, reconcileReminderSchedules]);

  // ---- Daily rollover ----
  // Resets today's tally when the date changes. Returns true if it reset.
  const rollDayIfNeeded = useCallback(() => {
    const now = todayString();
    if (now !== dateKeyRef.current) {
      setDateKey(now);
      setTimes(emptyTimes(medsRef.current));
      return true;
    }
    return false;
  }, []);

  // Covers the app sitting open across midnight.
  useEffect(() => {
    const id = setInterval(rollDayIfNeeded, DAY_CHECK_MS);
    return () => clearInterval(id);
  }, [rollDayIfNeeded]);

  // Covers returning from background; also flushes a save when leaving.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        rollDayIfNeeded();
      } else {
        clearTimeout(saveTimer.current);
        saveNow();
      }
    });
    return () => sub.remove();
  }, [rollDayIfNeeded, saveNow]);

  // ---- Auto-disarm a pending delete confirmation ----
  useEffect(() => {
    if (!confirmingDelete) return;
    const id = setTimeout(() => setConfirmingDelete(null), CONFIRM_RESET_MS);
    return () => clearTimeout(id);
  }, [confirmingDelete]);

  // ---- Dose actions ----
  const addDose = useCallback((id) => {
    rollDayIfNeeded(); // never let a dose land on yesterday's tally
    setTimes((prev) => {
      const med = medsRef.current.find((m) => m.id === id);
      if (!med) return prev;
      const arr = prev[id] || [];
      if (arr.length >= med.target) return prev;
      const next = [...arr, new Date().toISOString()];
      next.sort();
      return { ...prev, [id]: next };
    });
  }, [rollDayIfNeeded]);

  const handleReminderNotificationResponse = useCallback(async (response) => {
    if (!response || response.actionIdentifier !== REMINDER_MARK_TAKEN_ACTION_ID) return;
    const notification = response.notification;
    const key = `${notification?.request?.identifier || 'unknown'}:${response.actionIdentifier}`;
    if (handledNotificationResponsesRef.current.has(key)) return;
    handledNotificationResponsesRef.current.add(key);

    const data = notification?.request?.content?.data || {};
    if (data.type !== REMINDER_NOTIFICATION_TYPE || !data.medId) return;

    try {
      const result = await logDoseInStoredData(data.medId);
      if (result.meds && result.times && result.date) {
        setMeds(result.meds);
        setTimes(result.times);
        setDateKey(result.date);
      }
      if (result.logged) {
        setBanner(`✓ Logged ${result.medName || 'medication'}`);
      } else if (result.reason === 'done') {
        setBanner(`${result.medName || 'Medication'} is already done for today`);
      }
    } catch (e) {
      setBanner('Could not log that reminder dose.');
    }
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      handleReminderNotificationResponse
    );
    Notifications.getLastNotificationResponseAsync()
      .then(handleReminderNotificationResponse)
      .then(() => Notifications.clearLastNotificationResponseAsync?.())
      .catch(() => {});
    return () => sub.remove();
  }, [handleReminderNotificationResponse]);

  // ---- Siri deep links (eyetally://log/<medication-name>) ----
  const [pendingLink, setPendingLink] = useState(null);

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) setPendingLink({ url, t: Date.now() });
    });
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url) setPendingLink({ url, t: Date.now() });
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!pendingLink || !loaded) return;
    try {
      const parsed = Linking.parse(pendingLink.url);
      const action = (parsed.hostname || '').toLowerCase();
      const slug = (parsed.path || '').replace(/^\/+|\/+$/g, '').toLowerCase();
      if (action === 'log' && slug) {
        const med = medsRef.current.find((m) => slugify(m.name) === slug);
        if (med) {
          const already = (timesRef.current[med.id] || []).length >= med.target;
          if (already) {
            setBanner(`${med.name} is already done for today`);
          } else {
            addDose(med.id);
            setBanner(`✓ Logged ${med.name}`);
          }
        } else {
          setBanner('No medication matched that Siri link');
        }
      }
    } catch (e) {}
    setPendingLink(null);
  }, [pendingLink, loaded, addDose]);

  // Auto-dismiss the banner after 3 seconds.
  useEffect(() => {
    if (!banner) return;
    const id = setTimeout(() => setBanner(null), 3000);
    return () => clearTimeout(id);
  }, [banner]);

  const undoDose = useCallback((id) => {
    setTimes((prev) => {
      const arr = prev[id] || [];
      if (arr.length === 0) return prev;
      return { ...prev, [id]: arr.slice(0, -1) };
    });
  }, []);

  // ---- Time editing ----
  const openTimeEditor = useCallback((medId, index) => {
    const iso = (timesRef.current[medId] || [])[index];
    if (!iso) return;
    const d = new Date(iso);
    let hour = d.getHours();
    const am = hour < 12;
    hour = hour % 12;
    if (hour === 0) hour = 12;
    setEditingTime({ medId, index, hour, minute: d.getMinutes(), am });
  }, []);

  const saveEditedTime = useCallback(() => {
    setEditingTime((editing) => {
      if (!editing) return null;
      const { medId, index, hour, minute, am } = editing;
      const d = new Date();
      let h24 = hour % 12;
      if (!am) h24 += 12;
      d.setHours(h24, minute, 0, 0);
      setTimes((prev) => {
        const arr = prev[medId];
        if (!arr || index >= arr.length) return prev;
        const next = [...arr];
        next[index] = d.toISOString();
        next.sort();
        return { ...prev, [medId]: next };
      });
      return null;
    });
  }, []);

  const deleteEditedTime = useCallback(() => {
    setEditingTime((editing) => {
      if (!editing) return null;
      const { medId, index } = editing;
      setTimes((prev) => {
        const arr = prev[medId];
        if (!arr) return prev;
        return { ...prev, [medId]: arr.filter((_, i) => i !== index) };
      });
      return null;
    });
  }, []);

  const bumpEdit = useCallback((field, delta) => {
    setEditingTime((prev) => {
      if (!prev) return prev;
      if (field === 'hour') {
        let h = prev.hour + delta;
        if (h > 12) h = 1;
        if (h < 1) h = 12;
        return { ...prev, hour: h };
      }
      if (field === 'minute') {
        let m = prev.minute + delta;
        if (m > 59) m -= 60;
        if (m < 0) m += 60;
        return { ...prev, minute: m };
      }
      return { ...prev, am: !prev.am };
    });
  }, []);

  // ---- Medication editing ----
  const updateMed = useCallback((id, patch) => {
    setMeds((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const bumpTarget = useCallback((id, delta) => {
    setMeds((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, target: clampTarget(m.target + delta) } : m
      )
    );
  }, []);

  const addMed = useCallback(() => {
    const id = 'med-' + Date.now();
    setMeds((prev) => {
      const color = PALETTE[prev.length % PALETTE.length];
      return [...prev, { id, name: '', detail: '', target: 1, color, reminders: [] }];
    });
    setTimes((prev) => ({ ...prev, [id]: [] }));
  }, []);

  const deleteMed = useCallback((id) => {
    setConfirmingDelete((current) => {
      if (current !== id) return id; // first tap arms the confirmation
      const med = medsRef.current.find((m) => m.id === id);
      cancelMedicationReminderNotifications(med).catch(() => {});
      setMeds((prev) => prev.filter((m) => m.id !== id));
      setTimes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return null;
    });
  }, []);

  const addReminder = useCallback(async (medId) => {
    const med = medsRef.current.find((m) => m.id === medId);
    if (!med) return;

    const allowed = await ensureReminderPermission();
    if (!allowed) return;

    const reminder = makeReminderFromDate();
    try {
      const notificationId = await scheduleDoseReminder(med, reminder);
      setMeds((prev) =>
        prev.map((m) =>
          m.id === medId
            ? {
                ...m,
                reminders: [
                  ...sanitizeReminders(m.reminders),
                  { ...reminder, notificationId },
                ],
              }
            : m
        )
      );
      setBanner(`Reminder set for ${formatReminderTime(reminder)}`);
    } catch (e) {
      setBanner('Could not schedule that reminder. Please try again.');
    }
  }, [ensureReminderPermission]);

  const openReminderEditor = useCallback((medId, reminderId) => {
    const med = medsRef.current.find((m) => m.id === medId);
    const reminder = sanitizeReminders(med?.reminders).find((r) => r.id === reminderId);
    if (!reminder) return;
    let hour = clampHour(reminder.hour);
    const am = hour < 12;
    hour = hour % 12;
    if (hour === 0) hour = 12;
    setEditingReminder({
      medId,
      reminderId,
      hour,
      minute: clampMinute(reminder.minute),
      am,
    });
  }, []);

  const bumpReminderEdit = useCallback((field, delta) => {
    setEditingReminder((prev) => {
      if (!prev) return prev;
      if (field === 'hour') {
        let h = prev.hour + delta;
        if (h > 12) h = 1;
        if (h < 1) h = 12;
        return { ...prev, hour: h };
      }
      if (field === 'minute') {
        let m = prev.minute + delta;
        if (m > 59) m -= 60;
        if (m < 0) m += 60;
        return { ...prev, minute: m };
      }
      return { ...prev, am: !prev.am };
    });
  }, []);

  const saveEditedReminder = useCallback(async () => {
    const editing = editingReminder;
    if (!editing) return;
    const med = medsRef.current.find((m) => m.id === editing.medId);
    const reminder = sanitizeReminders(med?.reminders).find(
      (r) => r.id === editing.reminderId
    );
    if (!med || !reminder) {
      setEditingReminder(null);
      return;
    }

    const allowed = await ensureReminderPermission();
    if (!allowed) return;

    let h24 = editing.hour % 12;
    if (!editing.am) h24 += 12;
    const nextReminder = {
      ...reminder,
      hour: clampHour(h24),
      minute: clampMinute(editing.minute),
      notificationId: null,
    };

    try {
      await cancelReminderNotification(reminder);
      const notificationId = await scheduleDoseReminder(med, nextReminder);
      setMeds((prev) =>
        prev.map((m) =>
          m.id === editing.medId
            ? {
                ...m,
                reminders: sanitizeReminders(m.reminders).map((r) =>
                  r.id === editing.reminderId ? { ...nextReminder, notificationId } : r
                ),
              }
            : m
        )
      );
      setEditingReminder(null);
      setBanner(`Reminder updated to ${formatReminderTime(nextReminder)}`);
    } catch (e) {
      setBanner('Could not update that reminder. Please try again.');
    }
  }, [editingReminder, ensureReminderPermission]);

  const deleteReminder = useCallback((medId, reminderId) => {
    const med = medsRef.current.find((m) => m.id === medId);
    const reminder = sanitizeReminders(med?.reminders).find((r) => r.id === reminderId);
    cancelReminderNotification(reminder).catch(() => {});
    setMeds((prev) =>
      prev.map((m) =>
        m.id === medId
          ? {
              ...m,
              reminders: sanitizeReminders(m.reminders).filter((r) => r.id !== reminderId),
            }
          : m
      )
    );
    setBanner('Reminder removed');
  }, []);

  // ---- Derived values ----
  const totalDone = meds.reduce((s, m) => s + (times[m.id] || []).length, 0);
  const totalTarget = meds.reduce((s, m) => s + m.target, 0);
  const allDone = totalTarget > 0 && totalDone === totalTarget;

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const editingMed = editingTime
    ? meds.find((m) => m.id === editingTime.medId)
    : null;
  const editingReminderMed = editingReminder
    ? meds.find((m) => m.id === editingReminder.medId)
    : null;

  // ---- Render ----
  const canUseApp = hasPurchasedFullUnlock || trialStatus.isTrialActive;
  const waitingForInitialRestore =
    accessLoaded &&
    !hasPurchasedFullUnlock &&
    !trialStatus.isTrialActive &&
    !initialRestoreChecked;

  if (!accessLoaded || waitingForInitialRestore) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle={themeName === 'dark' ? 'light-content' : 'dark-content'} />
        <View style={styles.accessLoading}>
          <Text style={styles.accessLoadingText}>Loading EyeTally...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!canUseApp) {
    return (
      <PaywallScreen
        styles={styles}
        themeName={themeName}
        onPurchase={handlePurchaseFullUnlock}
        onRestore={handleRestorePurchases}
        purchaseBusy={purchaseBusy}
        restoreBusy={restoreBusy}
        error={paywallError}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={themeName === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={styles.appTitle}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              allowFontScaling={true}
            >
              EyeTally
            </Text>
            <Text style={styles.date} numberOfLines={2} allowFontScaling={true}>
              {dateLabel}
            </Text>
            <Text
              style={styles.headline}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {editMode
                ? 'Edit medications'
                : allDone
                ? 'All drops done! ✓'
                : `${totalDone} of ${totalTarget} done`}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', flexShrink: 0 }}>
            <Pressable
              onPress={() => setShowHelp(true)}
              style={({ pressed }) => [styles.helpBtn, pressed && styles.pressed]}
              accessibilityLabel="Help"
            >
              <Text style={styles.helpBtnText} allowFontScaling={false}>?</Text>
            </Pressable>
            <Pressable
              onPress={() => setThemeName(themeName === 'dark' ? 'light' : 'dark')}
              style={({ pressed }) => [styles.themeToggle, pressed && styles.pressed]}
              accessibilityLabel="Toggle dark mode"
            >
              <Text style={styles.themeToggleText} allowFontScaling={false}>
                {themeName === 'dark' ? '☀' : '☾'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setEditMode((e) => !e);
                setConfirmingDelete(null);
                setExpandedId(null);
              }}
              style={({ pressed }) => [
                styles.editToggle,
                { marginLeft: 8 },
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.editToggleText}>{editMode ? 'Done' : 'Edit'}</Text>
            </Pressable>
          </View>
        </View>

        {!hasPurchasedFullUnlock && trialStatus.isTrialActive && (
          <View style={styles.trialBanner}>
            <Text style={styles.trialBannerText}>
              Free trial: {trialStatus.daysRemaining} {trialStatus.daysRemaining === 1 ? 'day' : 'days'} left
            </Text>
          </View>
        )}

        {meds.length === 0 && !editMode && (
          <Text style={styles.emptyText}>
            No medications yet.{'\n'}Tap Edit to add one.
          </Text>
        )}

        {meds.map((med) =>
          editMode ? (
            <MedEditCard
              key={med.id}
              med={med}
              confirming={confirmingDelete === med.id}
              onUpdate={updateMed}
              onBumpTarget={bumpTarget}
              onDelete={deleteMed}
              onAddReminder={addReminder}
              onEditReminder={openReminderEditor}
              onDeleteReminder={deleteReminder}
              styles={styles}
              theme={theme}
            />
          ) : (
            <MedViewCard
              key={med.id}
              med={med}
              doseTimes={times[med.id] || []}
              onAddDose={(id) => {
                addDose(id);
                setExpandedId(id);
              }}
              onUndo={undoDose}
              onEditTime={openTimeEditor}
              styles={styles}
              theme={theme}
              expanded={expandedId === med.id}
              onToggleExpand={() =>
                setExpandedId((cur) => (cur === med.id ? null : med.id))
              }
            />
          )
        )}

        {editMode && (
          <Pressable
            onPress={addMed}
            style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          >
            <Text style={styles.addBtnText}>＋ Add a medication</Text>
          </Pressable>
        )}

        <Text style={styles.footer}>
          {editMode
            ? 'Tap Done when finished editing.'
            : 'Tap a time to change or remove it.\nCounts reset each morning.'}
        </Text>
      </ScrollView>

      <TimeEditModal
        editing={editingTime}
        medName={editingMed ? editingMed.name || 'Medication' : ''}
        onBump={bumpEdit}
        onSave={saveEditedTime}
        onDelete={deleteEditedTime}
        onCancel={() => setEditingTime(null)}
        styles={styles}
      />

      <ReminderTimeModal
        editing={editingReminder}
        medName={editingReminderMed ? editingReminderMed.name || 'Medication' : ''}
        onBump={bumpReminderEdit}
        onSave={saveEditedReminder}
        onCancel={() => setEditingReminder(null)}
        styles={styles}
      />

      <Modal visible={showHelp} transparent animationType="fade">
        <View style={styles.helpBackdrop}>
          <View style={styles.helpCard}>
            <ScrollView>
              <Text style={styles.helpTitle}>How to use EyeTally</Text>
              <Text style={styles.helpSubtitle}>
                A simple daily tracker for your eye drops.
              </Text>

              <Text style={styles.helpSectionTitle}>The basics</Text>
              <Text style={styles.helpBody}>
                Each medication has a card with a big +1 button. Tap it every
                time you take a dose. The number counts up until the daily
                total is reached, then the card shows "Done for today."
              </Text>
              <Text style={styles.helpStep}>
                Tap a card to see the times you took each dose. Tap a time
                to change or remove it. Tap Edit to add, rename, or remove
                medications.
              </Text>
              <Text style={styles.helpStep}>
                Counts reset automatically each morning.
              </Text>

              <Text style={styles.helpSectionTitle}>Dark mode</Text>
              <Text style={styles.helpBody}>
                Tap the moon or sun icon in the top-right to switch between
                light and dark backgrounds. Your choice is remembered.
              </Text>

              <Text style={styles.helpSectionTitle}>Voice logging with Siri</Text>
              <Text style={styles.helpBody}>
                You can log a dose hands-free by saying something like
                "Hey Siri, log Vital Tears." This takes a one-time setup for
                each medication:
              </Text>
              <Text style={styles.helpSectionTitle}>Your Siri links</Text>
              <Text style={styles.helpBody}>
                Tap a link below to copy it.
              </Text>
              {meds.map((med) => {
                const slug = slugify(med.name);
                const isCopied = copiedSlug === slug;
                return (
                  <Pressable
                    key={med.id}
                    onPress={() => copySiriLink(med)}
                    style={({ pressed }) => [
                      styles.siriLinkRow,
                      isCopied && styles.siriLinkRowCopied,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.siriLinkName}>{med.name || 'Unnamed'}</Text>
                      <Text style={styles.siriLinkUrl}>eyetally://log/{slug}</Text>
                    </View>
                    <Text style={styles.siriLinkCopyLabel}>
                      {isCopied ? 'Copied ✓' : 'Copy'}
                    </Text>
                  </Pressable>
                );
              })}
              <Text style={styles.helpStep}>
                1. Pick a medication above and tap "Copy" to copy its link.
              </Text>
              <Text style={styles.helpStep}>
                2. Open the Shortcuts app.
              </Text>
              <Text style={styles.helpStep}>
                3. Tap + then "Add Action" then "Open URL."
              </Text>
              <Text style={styles.helpStep}>
                4. Paste the copied link into the URL field.
              </Text>
              <Text style={styles.helpStep}>
                5. Tap the shortcut's name at the top. Rename it to what you'll
                say to Siri — for example, "Log Vital Tears."
              </Text>
              <Text style={styles.helpStep}>
                6. Repeat steps 1 through 5 for each medication.
              </Text>

              <Text style={styles.helpSectionTitle}>Important</Text>
              <Text style={styles.helpDisclaimer}>
                EyeTally is a personal tracker, not medical advice. Always follow
                the schedule and instructions from your doctor or pharmacist. If
                you miss a dose, are unsure whether you took one, or have questions
                about your medications, contact your healthcare provider — do not
                rely on this app to make medical decisions. In an emergency, call 911.
              </Text>

              <Text style={styles.helpSectionTitle}>Privacy</Text>
              <Text style={styles.helpBody}>
                EyeTally stores everything on your device only. Nothing is
                collected, shared, or sent to any server. Read the full policy:
              </Text>
              <Pressable
                onPress={() => Linking.openURL('https://lmulc314.github.io/itally/privacy.html')}
                style={({ pressed }) => [styles.privacyLink, pressed && styles.pressed]}
              >
                <Text style={styles.privacyLinkText}>View Privacy Policy →</Text>
              </Pressable>

              <Pressable
                onPress={() => setShowHelp(false)}
                style={({ pressed }) => [styles.helpClose, pressed && styles.pressed]}
              >
                <Text style={styles.helpCloseText}>Got it</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {banner && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ---- Styles ------------------------------------------------------------

const makeStyles = (t) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.bg },

  scroll: { padding: 18, paddingBottom: 44 },

  accessLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  accessLoadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: t.ink,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    marginTop: 4,
    gap: 8,
  },

  appTitle: {
    fontSize: 32, fontWeight: '700', color: t.ink,
    letterSpacing: -0.5,
  },
  date: {
    fontSize: 15, color: t.inkSoft, marginTop: 2, fontWeight: '400',
  },
  headline: {
    fontSize: 22, fontWeight: '600', color: t.ink,
    marginTop: 14, letterSpacing: -0.3,
  },

  trialBanner: {
    backgroundColor: t.cream,
    borderWidth: 1,
    borderColor: t.hairline,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: -8,
    marginBottom: 14,
  },
  trialBannerText: {
    color: t.ink,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },

  editToggle: {
    backgroundColor: t.cream,
    borderWidth: 1.5, borderColor: t.ink,
    borderRadius: 999,
    paddingHorizontal: 20, paddingVertical: 10,
    marginTop: 6,
  },
  editToggleText: { fontSize: 16, fontWeight: '600', color: t.ink },

  card: {
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.hairline,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardFinished: {
    borderColor: t.done, borderWidth: 1.5,
  },

  capDot: {
    width: 14, height: 14, borderRadius: 7, marginRight: 10,
    borderWidth: 0,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  medName: {
    fontSize: 20, fontWeight: '600', color: t.ink,
    flexShrink: 1, letterSpacing: -0.2,
  },
  medDetail: {
    fontSize: 14, color: t.inkSoft, marginTop: 4,
    marginLeft: 24, fontWeight: '400',
  },
  medCount: {
    fontSize: 24,
    color: t.ink,
    marginTop: 10,
    marginLeft: 24,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  medCountDone: { color: t.done, fontSize: 15, fontWeight: '600' },
  lastTaken: {
    fontSize: 17,
    color: t.inkSoft,
    marginTop: 6,
    marginLeft: 24,
    fontWeight: '500',
  },

  plusBtn: {
    width: 78, height: 78, borderRadius: 39,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: 'transparent',
  },
  plusText: { color: '#FFFFFF', fontSize: 26, fontWeight: '700' },

  minusBtn: {
    marginTop: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  minusText: {
    fontSize: 15, color: t.inkSoft, fontWeight: '500',
    textDecorationLine: 'underline',
  },

  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.55 },

  timeRow: {
    flexDirection: 'row', flexWrap: 'wrap', marginTop: 12,
    paddingTop: 12, marginLeft: 24,
    borderTopWidth: 1, borderTopColor: t.divider,
  },
  timeChip: {
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: t.hairline,
    borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6,
    marginRight: 8, marginBottom: 6,
  },
  timeChipText: { fontSize: 14, fontWeight: '500', color: t.ink },

  nameInput: {
    fontSize: 20,
    fontWeight: '600',
    color: t.ink,
    backgroundColor: t.cream,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: t.hairline,
    paddingHorizontal: 12, paddingVertical: 10,
    letterSpacing: -0.2,
  },
  detailInput: {
    fontSize: 15,
    color: t.ink,
    fontWeight: '400',
    backgroundColor: t.cream,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: t.hairline,
    paddingHorizontal: 12, paddingVertical: 10, marginTop: 10,
  },

  targetRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 16,
  },
  targetLabel: {
    fontSize: 15, color: t.ink, fontWeight: '500', marginRight: 10,
  },
  stepBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: t.cream,
    borderWidth: 1, borderColor: t.hairline,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnText: { fontSize: 22, fontWeight: '600', color: t.ink },
  targetValue: {
    fontSize: 20, fontWeight: '600', color: t.ink,
    marginHorizontal: 14, minWidth: 32, textAlign: 'center',
  },

  colorLabel: {
    fontSize: 15, color: t.ink, fontWeight: '500',
    marginTop: 16, marginBottom: 10,
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorSwatch: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  colorSwatchSelected: { borderColor: t.ink, borderWidth: 3 },
  colorCheck: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  remindersSection: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: t.divider,
  },
  remindersTitle: {
    fontSize: 15,
    color: t.inkSoft,
    fontWeight: '600',
    marginBottom: 8,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reminderTimeBtn: {
    backgroundColor: t.cream,
    borderWidth: 1,
    borderColor: t.hairline,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minWidth: 108,
    alignItems: 'center',
  },
  reminderTimeText: {
    fontSize: 16,
    color: t.ink,
    fontWeight: '600',
  },
  reminderRemoveBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  reminderRemoveText: {
    color: t.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  addReminderBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  addReminderText: {
    color: t.ink,
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  banner: {
    position: 'absolute', bottom: 30, left: 20, right: 20,
    backgroundColor: t.ink, borderRadius: 12, padding: 14,
    alignItems: 'center',
  },
  bannerText: { color: t.card, fontSize: 16, fontWeight: '600' },

  modalBackdrop: {
    flex: 1, backgroundColor: t.overlay,
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: t.card, borderRadius: 20, padding: 22,
    width: '100%', maxWidth: 360,
  },
  modalTitle: {
    fontSize: 18, fontWeight: '600', color: t.ink, textAlign: 'center',
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', marginVertical: 18,
  },
  pickerCol: { alignItems: 'center' },
  pickBtn: { padding: 10 },
  pickBtnText: { fontSize: 22, color: t.inkSoft, fontWeight: '600' },
  pickValue: {
    fontSize: 40, fontWeight: '700', color: t.ink,
    minWidth: 60, textAlign: 'center', letterSpacing: -1,
  },
  pickColon: {
    fontSize: 40, fontWeight: '700', color: t.ink, marginHorizontal: 4,
  },
  ampmBtn: {
    marginLeft: 16, backgroundColor: t.cream,
    borderWidth: 1, borderColor: t.hairline, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  ampmText: { fontSize: 18, fontWeight: '700', color: t.ink },
  modalSave: {
    backgroundColor: t.ink, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 6,
  },
  modalSaveText: { color: t.card, fontSize: 17, fontWeight: '600' },
  modalDelete: {
    marginTop: 8, paddingVertical: 10, alignItems: 'center',
  },
  modalDeleteText: { color: t.danger, fontSize: 15, fontWeight: '600' },
  modalCancel: { paddingVertical: 8, alignItems: 'center' },
  modalCancelText: { color: t.inkSoft, fontSize: 15, fontWeight: '500' },

  paywallWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: 22,
  },
  paywallCard: {
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.hairline,
    borderRadius: 16,
    padding: 24,
  },
  paywallEyebrow: {
    color: t.inkSoft,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  paywallTitle: {
    color: t.ink,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  paywallBody: {
    color: t.inkSoft,
    fontSize: 17,
    lineHeight: 24,
    marginTop: 12,
    marginBottom: 22,
  },
  paywallError: {
    color: t.danger,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 14,
  },
  paywallButton: {
    backgroundColor: t.ink,
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  paywallButtonText: {
    color: t.card,
    fontSize: 17,
    fontWeight: '700',
  },
  restoreLink: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 8,
  },
  restoreLinkText: {
    color: t.ink,
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  suggestionList: {
    backgroundColor: t.cream,
    borderWidth: 1, borderColor: t.hairline,
    borderRadius: 10, marginTop: 6, marginBottom: 4,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: t.hairline,
  },
  suggestionText: { fontSize: 16, fontWeight: '500', color: t.ink },

  helpBtn: {
    marginTop: 6,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: t.cream,
    borderWidth: 1.5, borderColor: t.ink,
    alignItems: 'center', justifyContent: 'center',
  },
  helpBtnText: { fontSize: 22, fontWeight: '700', color: t.ink },

  helpBackdrop: {
    flex: 1, backgroundColor: t.overlay,
    padding: 20, justifyContent: 'center',
  },
  helpCard: {
    backgroundColor: t.card, borderRadius: 20, padding: 24,
    maxHeight: '85%',
  },
  helpTitle: {
    fontSize: 26, fontWeight: '700', color: t.ink,
    marginBottom: 8, letterSpacing: -0.4,
  },
  helpSubtitle: {
    fontSize: 15, color: t.inkSoft, marginBottom: 20,
    fontWeight: '400',
  },
  helpSectionTitle: {
    fontSize: 19, fontWeight: '600', color: t.ink,
    marginTop: 22, marginBottom: 10, letterSpacing: -0.2,
  },
  helpBody: {
    fontSize: 16, color: t.ink, lineHeight: 24, fontWeight: '400',
  },
  helpStep: {
    fontSize: 16, color: t.ink, lineHeight: 24, marginTop: 8,
    fontWeight: '400',
  },
  helpDisclaimer: {
    fontSize: 15,
    color: t.ink,
    lineHeight: 22,
    fontWeight: '500',
    backgroundColor: t.cream,
    borderWidth: 1,
    borderColor: t.hairline,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  privacyLink: {
    backgroundColor: t.cream,
    borderWidth: 1,
    borderColor: t.hairline,
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    alignItems: 'center',
  },
  privacyLinkText: {
    fontSize: 16,
    color: t.ink,
    fontWeight: '600',
  },
  helpCode: {
    fontFamily: 'Courier',
    fontSize: 14,
    color: t.ink,
    backgroundColor: t.bg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 10,
    overflow: 'hidden',
  },
  helpClose: {
    backgroundColor: t.ink, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 24,
  },
  helpCloseText: { color: t.card, fontSize: 17, fontWeight: '600' },
  siriLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.bg,
    borderWidth: 1,
    borderColor: t.hairline,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 10,
  },
  siriLinkRowCopied: {
    backgroundColor: t.cream,
    borderColor: t.done,
  },
  siriLinkName: {
    fontSize: 16,
    fontWeight: '600',
    color: t.ink,
  },
  siriLinkUrl: {
    fontSize: 13,
    color: t.inkSoft,
    fontFamily: 'Courier',
    marginTop: 2,
  },
  siriLinkCopyLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: t.ink,
    marginLeft: 12,
  },

  themeToggle: {
    marginTop: 6, marginLeft: 8,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: t.cream,
    borderWidth: 1.5, borderColor: t.ink,
    alignItems: 'center', justifyContent: 'center',
  },
  themeToggleText: { fontSize: 18, color: t.ink },

  progressBar: {
    marginLeft: 24, marginTop: 8,
    height: 8, backgroundColor: t.divider, borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%', borderRadius: 4,
  },

  pipRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    marginTop: 8, marginLeft: 24,
  },
  pip: {
    width: 14, height: 14, borderRadius: 7, borderWidth: 1.5,
    borderColor: t.inkSoft,
    backgroundColor: 'transparent',
    marginRight: 6, marginBottom: 4,
  },

  buttons: { alignItems: 'center', marginLeft: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  cardText: { flex: 1 },
  emptyText: {
    fontSize: 18, fontWeight: '500', color: t.ink,
    textAlign: 'center', marginVertical: 40, lineHeight: 28,
  },

  deleteBtn: {
    marginTop: 16, alignSelf: 'flex-end',
    paddingHorizontal: 14, paddingVertical: 8,
  },
  deleteBtnConfirm: {
    backgroundColor: t.danger, borderRadius: 8,
  },
  deleteBtnText: { color: t.danger, fontSize: 14, fontWeight: '600' },

  addBtn: {
    backgroundColor: t.ink, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 6,
  },
  addBtnText: { color: t.card, fontSize: 17, fontWeight: '600' },

  footer: {
    textAlign: 'center', color: t.inkSoft, fontSize: 13,
    fontWeight: '400', marginTop: 16, lineHeight: 20,
  },
});
