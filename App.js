import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import {
  AppState,
  Modal,
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
const MIN_TARGET = 1;
const MAX_TARGET = 24;
const DAY_CHECK_MS = 30 * 1000;   // how often to check for midnight rollover
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

function MedEditCard({ med, confirming, onUpdate, onBumpTarget, onDelete, styles, theme }) {
  const [focused, setFocused] = useState(false);
  const suggestions = librarySuggestions(med.name);
  const exactLibraryMatch = MED_LIBRARY.some((m) => m.name === med.name);

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

// ---- App --------------------------------------------------------------

export default function App() {
  const [meds, setMeds] = useState(DEFAULT_MEDS);
  const [times, setTimes] = useState(() => emptyTimes(DEFAULT_MEDS));
  const [dateKey, setDateKey] = useState(todayString());
  const [editMode, setEditMode] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(null);
  const [editingTime, setEditingTime] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState(null);
  const [themeName, setThemeName] = useState('light');
  const theme = themeName === 'dark' ? DARK_THEME : LIGHT_THEME;
  const styles = React.useMemo(() => makeStyles(theme), [theme]);

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
  useEffect(() => { medsRef.current = meds; }, [meds]);
  useEffect(() => { timesRef.current = times; }, [times]);
  useEffect(() => { dateKeyRef.current = dateKey; }, [dateKey]);
  useEffect(() => { loadedRef.current = loaded; }, [loaded]);

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

  // ---- Siri deep links (eyetally://log/<medication-name>) ----
  const [pendingLink, setPendingLink] = useState(null);
  const [banner, setBanner] = useState(null);

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
      return [...prev, { id, name: '', detail: '', target: 1, color }];
    });
    setTimes((prev) => ({ ...prev, [id]: [] }));
  }, []);

  const deleteMed = useCallback((id) => {
    setConfirmingDelete((current) => {
      if (current !== id) return id; // first tap arms the confirmation
      setMeds((prev) => prev.filter((m) => m.id !== id));
      setTimes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return null;
    });
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

  // ---- Render ----
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={themeName === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.scroll}>
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
