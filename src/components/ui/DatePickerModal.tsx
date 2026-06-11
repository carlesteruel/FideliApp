import React, { useMemo, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { colors } from '../../theme';

interface DatePickerModalProps {
  visible: boolean;
  /** Valor inicial en formato ISO (YYYY-MM-DD) o null */
  value?: string | null;
  title?: string;
  onClose: () => void;
  onConfirm: (isoDate: string) => void;
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const ITEM_HEIGHT = 44;

function daysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

function parseIso(value?: string | null): { d: number; m: number; y: number } {
  const now = new Date();
  const fallback = { d: 1, m: 0, y: now.getFullYear() - 25 };
  if (!value) return fallback;
  const parts = value.split('-');
  if (parts.length !== 3) return fallback;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return fallback;
  return { d, m, y };
}

export function DatePickerModal({ visible, value, title, onClose, onConfirm }: DatePickerModalProps) {
  const initial = useMemo(() => parseIso(value), [value, visible]);
  const [day, setDay] = useState(initial.d);
  const [month, setMonth] = useState(initial.m);
  const [year, setYear] = useState(initial.y);

  // Sincronizamos el estado interno cada vez que se abre el modal.
  React.useEffect(() => {
    if (visible) {
      const p = parseIso(value);
      setDay(p.d);
      setMonth(p.m);
      setYear(p.y);
    }
  }, [visible]);

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = currentYear; y >= currentYear - 100; y--) arr.push(y);
    return arr;
  }, [currentYear]);

  const maxDay = daysInMonth(month, year);
  const days = useMemo(() => Array.from({ length: maxDay }, (_, i) => i + 1), [maxDay]);
  const safeDay = Math.min(day, maxDay);

  const handleConfirm = () => {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(safeDay).padStart(2, '0');
    onConfirm(`${year}-${mm}-${dd}`);
  };

  const Column = ({ data, selected, onSelect, render, width }: {
    data: (number | string)[];
    selected: number | string;
    onSelect: (v: any) => void;
    render: (v: any) => string;
    width: number;
  }) => (
    <ScrollView
      style={{ width, height: ITEM_HEIGHT * 5 }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
    >
      {data.map((v) => {
        const isSel = v === selected;
        return (
          <TouchableOpacity key={String(v)} onPress={() => onSelect(v)} style={s.item} activeOpacity={0.7}>
            <Text style={[s.itemText, isSel ? s.itemTextSel : s.itemTextUnsel]} numberOfLines={1}>
              {render(v)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.bg}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.header}>
            <Text style={s.title}>{title ?? 'Selecciona la fecha'}</Text>
            <TouchableOpacity onPress={onClose}><Text style={s.close}>✕</Text></TouchableOpacity>
          </View>

          <View style={s.pickerRow}>
            {/* Línea de selección central */}
            <View pointerEvents="none" style={s.selectionBand} />
            <Column
              data={days}
              selected={safeDay}
              onSelect={setDay}
              render={(v) => String(v)}
              width={70}
            />
            <Column
              data={MONTHS.map((_, i) => i)}
              selected={month}
              onSelect={setMonth}
              render={(v) => MONTHS[v as number]}
              width={140}
            />
            <Column
              data={years}
              selected={year}
              onSelect={setYear}
              render={(v) => String(v)}
              width={90}
            />
          </View>

          <View style={s.preview}>
            <Text style={s.previewText}>
              {safeDay} de {MONTHS[month]} de {year}
            </Text>
          </View>

          <TouchableOpacity style={s.confirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
            <Text style={s.confirmText}>Guardar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  bg:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:     { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  handle:    { width: 48, height: 6, backgroundColor: colors.gray200, borderRadius: 99, alignSelf: 'center', marginBottom: 16 },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title:     { color: colors.gray900, fontSize: 20, fontWeight: '700' },
  close:     { color: colors.gray400, fontSize: 20 },
  pickerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  selectionBand: {
    position: 'absolute', left: 0, right: 0, top: ITEM_HEIGHT * 2, height: ITEM_HEIGHT,
    backgroundColor: colors.primary50, borderRadius: 12,
  },
  item:      { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  itemText:  { fontSize: 18 },
  itemTextSel:   { color: colors.primary600, fontWeight: '700' },
  itemTextUnsel: { color: colors.gray400, fontWeight: '500' },
  preview:   { alignItems: 'center', marginTop: 16, marginBottom: 8 },
  previewText: { color: colors.gray700, fontSize: 16, fontWeight: '600' },
  confirmBtn: { backgroundColor: colors.primary500, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  confirmText:{ color: colors.white, fontSize: 16, fontWeight: '700' },
});
