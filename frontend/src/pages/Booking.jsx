import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { BASE, createBooking, fetchAvailability, fetchBankInfo, fetchRoomDetail } from "../api";
import { useI18n } from "../context/I18n.jsx";
import { useCurrency } from "../context/Currency.jsx";
import { useUser } from "../context/User.jsx";
import { useNotifications } from "../context/Notifications.jsx";
import ShareDropdown from "../components/ShareDropdown.jsx";

function pad2(n){ return String(n).padStart(2,"0"); }
function fmtDDMMYYYYFromISO(iso){
  if(!iso) return "";
  const d=new Date(iso+"T00:00:00");
  return `${pad2(d.getDate())}-${pad2(d.getMonth()+1)}-${d.getFullYear()}`;
}
function isoFromDate(d){
  const x = new Date(d);
  const y=x.getFullYear(), m=pad2(x.getMonth()+1), day=pad2(x.getDate());
  return `${y}-${m}-${day}`;
}
function addDays(d, n){
  const x=new Date(d);
  x.setDate(x.getDate()+n);
  return x;
}
function isSameDay(a,b){
  return a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function isBeforeDay(a,b){
  const aa=new Date(a.getFullYear(),a.getMonth(),a.getDate()).getTime();
  const bb=new Date(b.getFullYear(),b.getMonth(),b.getDate()).getTime();
  return aa<bb;
}
function rangeIntersects(aFrom,aTo,bFrom,bTo){
  // treat ranges as [from, to) (checkout exclusive)
  return !(aTo <= bFrom || aFrom >= bTo);
}
function clampToNoPastToday() {
  const now=new Date();
  const today=new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { now, today };
}

function getMonthStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

const HOUR_OPTIONS = [];
for (let h = 0; h <= 23; h++) {
  for (const m of [0, 30]) {
    if (h === 23 && m === 30) {
      HOUR_OPTIONS.push("23:30");
      break;
    }
    HOUR_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

function timeToMinutes(t) {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default function Booking() {
  const nav = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  const { formatMoney } = useCurrency();
  const rentType = searchParams.get("rent") || "overnight";
  const isHourly = rentType === "hourly";
  const roomId = Number(id);
  const { me } = useUser();
  const { addNotification } = useNotifications();

  const [room, setRoom] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [dayPrices, setDayPrices] = useState({});
  const [hourlySlots, setHourlySlots] = useState([]);
  const [bank, setBank] = useState(null);
  const [displayMonth, setDisplayMonth] = useState(() => new Date());

  const [hourlyDate, setHourlyDate] = useState(null);
  const [hourlyStart, setHourlyStart] = useState("08:00");
  const [hourlyEnd, setHourlyEnd] = useState("12:00");
  const [paymentType, setPaymentType] = useState("deposit"); // "deposit" | "full"

  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [createdId, setCreatedId] = useState(null);

  const [range, setRange] = useState({ from: undefined, to: undefined });
  const [hoverDay, setHoverDay] = useState(null);
  const [popover, setPopover] = useState(null);
  const popRef = useRef(null);
  const [shareOpen, setShareOpen] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    guests: 2,
    note: "",
    payment_method: "sepay",
    deposit_percent: 30,
    remainder_payment_method: "cash"
  });

  useEffect(() => {
    setErr(""); setOk("");
    fetchRoomDetail(roomId).then(d => setRoom(d.room)).catch(()=>setErr(t("booking.err_room")));
    fetchAvailability(roomId).then(d => { setBlocks(d.blocks||[]); }).catch(()=>{});
  }, [roomId, t]);

  useEffect(() => {
    const month = getMonthStr(displayMonth);
    fetchAvailability(roomId, month).then(d => setDayPrices(d.day_prices || {})).catch(()=>{});
  }, [roomId, displayMonth]);

  useEffect(() => {
    if (isHourly && hourlyDate) {
      const dateIso = typeof hourlyDate === "string" ? hourlyDate : isoFromDate(hourlyDate);
      fetchAvailability(roomId, null, dateIso).then(d => {
        setHourlySlots(d.hourly_slots || []);
      }).catch(()=>setHourlySlots([]));
    } else {
      setHourlySlots([]);
    }
  }, [roomId, isHourly, hourlyDate]);

  // If not logged in: keep page accessible, but block submit & show hint
  useEffect(() => {
    if (!me) return;
    // preload name, phone, email from profile (đặt phòng sau không cần nhập)
    setForm(s => ({
      ...s,
      full_name: s.full_name || (me.name || ""),
      phone: s.phone || (me.phone || ""),
      email: s.email || (me.email || "")
    }));
  }, [me]);

  // Lấy thông tin ngân hàng khi đã tạo booking (để hiển thị QR và transfer info)
  useEffect(() => {
    if (!createdId) return;
    fetchBankInfo().then(d => setBank(d)).catch(() => setBank(null));
  }, [createdId]);

  // Tự mở panel chia sẻ khi đặt phòng thành công (khuyến khích chia sẻ)
  useEffect(() => {
    if (createdId) setShareOpen(true);
  }, [createdId]);

  const { now, today } = useMemo(() => clampToNoPastToday(), []);

  // Thuê qua đêm: không chọn hôm nay nếu đã qua 14:00. Thuê theo giờ: vẫn chọn hôm nay, chỉ chặn giờ đã qua.
  const disableTodayByTime = useMemo(() => {
    const hh = now.getHours();
    return hh >= 14; // after 14:00, overnight cannot start today
  }, [now]);

  const blockedDays = useMemo(() => {
    const days = [];
    for (const b of blocks) {
      const ci = new Date(b.check_in + "T00:00:00");
      const co = new Date(b.check_out + "T00:00:00");
      if (isHourly) {
        // For hourly: disable days with overnight bookings (full day blocked)
        if (!b.booking_type || b.booking_type === "overnight") {
          for (let d = new Date(ci); isBeforeDay(d, co); d = addDays(d, 1)) {
            days.push(new Date(d));
          }
        }
      } else {
        // For overnight: disable all booked days
        for (let d = new Date(ci); isBeforeDay(d, co); d = addDays(d, 1)) {
          days.push(new Date(d));
        }
      }
    }
    return days;
  }, [blocks, isHourly]);

  const statusByIsoDay = useMemo(() => {
    const map = new Map();
    for (const b of blocks) {
      const ci = new Date(b.check_in + "T00:00:00");
      const co = new Date(b.check_out + "T00:00:00");
      for (let d = new Date(ci); isBeforeDay(d, co); d = addDays(d, 1)) {
        map.set(isoFromDate(d), b.status);
      }
    }
    return map;
  }, [blocks]);

  const disabled = useMemo(() => {
    const list = [];
    // past
    list.push({ before: today });
    // Thuê qua đêm: chặn hôm nay nếu đã qua 14:00. Thuê theo giờ: vẫn cho chọn hôm nay.
    if (disableTodayByTime && !isHourly) list.push(today);
    // booked
    list.push(...blockedDays);
    return list;
  }, [today, disableTodayByTime, blockedDays, isHourly]);

  const modifiers = useMemo(() => {
    const pending = [];
    const confirmed = [];
    for (const d of blockedDays) {
      const st = statusByIsoDay.get(isoFromDate(d));
      if (st === "confirmed") confirmed.push(d);
      else pending.push(d);
    }
    const weekend = (date) => {
      const d = date.getDay();
      return d === 0 || d === 6;
    };
    const VIETNAM_HOLIDAYS = [[0, 1], [2, 10], [3, 30], [4, 1], [8, 2]];
    const holiday = (date) => VIETNAM_HOLIDAYS.some(([mm, dd]) => date.getMonth() === mm && date.getDate() === dd);
    return { pending, confirmed, hover: hoverDay ? [hoverDay] : [], weekend, holiday };
  }, [blockedDays, statusByIsoDay, hoverDay]);

  const modifierStyles = {
    pending: { background: "rgba(245,158,11,.18)", borderRadius: "10px" },
    confirmed: { background: "rgba(34,197,94,.16)", borderRadius: "10px" },
    hover: { background: "rgba(99,102,241,.12)", borderRadius: "10px", outline: "1px solid rgba(99,102,241,.3)" }
  };

  // Thuê theo giờ: khi chọn hôm nay chỉ hiển thị các khung giờ chưa qua; nếu đã qua 23h thì cho chọn tiếp từ 00:00 (ngày hôm sau)
  const hourlyIsToday = hourlyDate && isSameDay(hourlyDate, today);
  const allowedStartOptions = useMemo(() => {
    if (!hourlyIsToday) return HOUR_OPTIONS;
    const n = new Date();
    const nowMin = n.getHours() * 60 + n.getMinutes();
    const todaySlots = HOUR_OPTIONS.filter(t => timeToMinutes(t) > nowMin);
    if (todaySlots.length > 0) return todaySlots;
    return HOUR_OPTIONS;
  }, [hourlyIsToday]);
  const allowedEndOptions = useMemo(() => {
    const startMin = timeToMinutes(hourlyStart);
    return HOUR_OPTIONS.filter(t => timeToMinutes(t) > startMin);
  }, [hourlyStart]);

  // Khi chọn hôm nay mà start/end đã qua → đẩy về khung giờ hợp lệ (hoặc 00:00 ngày hôm sau)
  useEffect(() => {
    if (!isHourly || !hourlyDate || !isSameDay(hourlyDate, today)) return;
    const n = new Date();
    const nowMin = n.getHours() * 60 + n.getMinutes();
    const startMin = timeToMinutes(hourlyStart);
    const endMin = timeToMinutes(hourlyEnd);
    const isNextDaySlot = nowMin >= 23 * 60 && startMin < 23 * 60;
    if (isNextDaySlot && endMin > startMin) return;
    if (startMin <= nowMin || endMin <= startMin) {
      const first = allowedStartOptions[0];
      if (first) {
        setHourlyStart(first);
        const afterFirst = HOUR_OPTIONS.filter(t => timeToMinutes(t) > timeToMinutes(first));
        if (afterFirst[0]) setHourlyEnd(afterFirst[0]);
      }
    }
  }, [isHourly, hourlyDate, today, hourlyStart, hourlyEnd, allowedStartOptions]);

  const defaultPrice = Number(room?.price_per_night || 0);
  const defaultHourlyPrice = Number(room?.price_per_hour || 0);

  const DayButtonWithPrice = useMemo(() => {
    const Inner = React.forwardRef(function DayButtonWithPriceInner(props, ref) {
      const { day, children, ...buttonProps } = props;
      const date = day?.date;
      const iso = date ? (day.isoDate || isoFromDate(date)) : "";
      let priceLabel = "";
      if (isHourly) {
        priceLabel = `${(defaultHourlyPrice / 1000).toFixed(0)}k/h`;
      } else {
        const price = dayPrices[iso] ?? defaultPrice;
        priceLabel = `${(price / 1000).toFixed(0)}k`;
      }
      return (
        <button ref={ref} {...buttonProps} type={buttonProps.type || "button"}>
          <span className="rdp-day-content">
            <span className="rdp-day-num">{children}</span>
            <span className="rdp-day-price">{priceLabel}</span>
          </span>
        </button>
      );
    });
    return Inner;
  }, [isHourly, defaultPrice, defaultHourlyPrice, dayPrices]);

  const components = useMemo(() => ({ DayButton: DayButtonWithPrice }), [DayButtonWithPrice]);

  function showTooltip(day, event) {
    const date = day?.date ?? day;
    const iso = date ? isoFromDate(date) : "";
    const st = statusByIsoDay.get(iso);
    if (!st) { setPopover(null); return; }
    const rect = event?.currentTarget?.getBoundingClientRect?.();
    if (!rect) return;
    setPopover({
      x: rect.left + rect.width / 2,
      y: rect.top,
      title: t("booking.popover_busy"),
      desc: st === "confirmed" ? t("booking.popover_confirmed") : t("booking.popover_pending")
    });
  }

  function hideTooltip() { setPopover(null); }

  function nearestValidRangeFrom(fromDay) {
    // suggest the earliest possible to-day after fromDay that doesn't intersect blocks
    // We'll attempt to pick min 1 night range.
    let start = new Date(fromDay);
    // if start is disabled, move forward until enabled
    const isDisabledDay = (d) => {
      if (isBeforeDay(d, today)) return true;
      if (disableTodayByTime && isSameDay(d, today)) return true;
      const iso = isoFromDate(d);
      return statusByIsoDay.has(iso);
    };
    while (isDisabledDay(start)) start = addDays(start, 1);

    // choose end = start+1 and extend until first available checkout (checkout day can be a blocked day? checkout can be on blocked day? checkout is exclusive so allowed even if that day is blocked as start of another booking; we still allow checkout on a blocked day as long as nights are free. Here we keep it simple: require each night day free; thus checkout day may be blocked - it's okay.
    let end = addDays(start, 1);

    // Find first end that doesn't intersect any booking interval
    const startISO = isoFromDate(start);
    for (let tries=0; tries<365; tries++){
      const endISO = isoFromDate(end);
      let ok = true;
      // check intersection with each block
      for (const b of blocks) {
        if (rangeIntersects(startISO, endISO, b.check_in, b.check_out)) { ok=false; break; }
      }
      if (ok) return { from: start, to: end };
      end = addDays(end, 1);
    }
    return { from: start, to: addDays(start, 1) };
  }

  function onSelectRange(next) {
    setErr(""); setOk("");
    if (!next) return;

    // react-day-picker may set from/to undefined as user picks
    const { from, to } = next;

    if (from && !to) {
      // when picking start, if start disabled -> snap to nearest valid start
      const snap = nearestValidRangeFrom(from);
      setRange({ from: snap.from, to: undefined });
      return;
    }

    if (from && to) {
      // Validate (no overlap)
      const fromISO = isoFromDate(from);
      const toISO = isoFromDate(to);
      if (!(new Date(toISO+"T00:00:00") > new Date(fromISO+"T00:00:00"))) {
        setErr(t("booking.err_checkout_after"));
        setRange({ from, to: undefined });
        return;
      }
      for (const b of blocks) {
        if (rangeIntersects(fromISO, toISO, b.check_in, b.check_out)) {
          // propose nearest
          const suggestion = nearestValidRangeFrom(from);
          setErr(t("booking.err_range_overlap"));
          setRange({ from: suggestion.from, to: suggestion.to });
          return;
        }
      }
      setRange({ from, to });
      return;
    }

    setRange(next);
  }

  const total = useMemo(() => {
    if (!room) return 0;
    if (isHourly) {
      if (!hourlyDate || !hourlyStart || !hourlyEnd) return 0;
      const [h1, m1] = hourlyStart.split(":").map(Number);
      const [h2, m2] = hourlyEnd.split(":").map(Number);
      const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (mins <= 0) return 0;
      const hours = mins / 60;
      return Math.round(hours * Number(room.price_per_hour || 0));
    }
    if (!range.from || !range.to) return 0;
    const defaultPrice = Number(room.price_per_night || 0);
    let sum = 0;
    let d = new Date(range.from.getTime());
    const end = new Date(range.to.getTime());
    while (d < end) {
      sum += dayPrices[isoFromDate(d)] ?? defaultPrice;
      d.setDate(d.getDate() + 1);
    }
    return sum;
  }, [room, range, dayPrices, isHourly, hourlyDate, hourlyStart, hourlyEnd]);

  async function submit(e) {
  e.preventDefault();
  setErr("");
  setOk("");

  if (!me) {
    setErr(t("booking.err_login"));
    return;
  }

  const fullName = String(form.full_name || "").trim();
  const phone = String(form.phone || "").trim();
  const email = String(form.email || "").trim();
  if (!fullName) {
    setErr(t("booking.err_required_full_name"));
    return;
  }
  if (!phone) {
    setErr(t("booking.err_required_phone"));
    return;
  }
  if (!email) {
    setErr(t("booking.err_required_email"));
    return;
  }

  let payload;
  if (isHourly) {
    if (!hourlyDate) {
      setErr(t("booking.err_choose_date"));
      return;
    }
    let dateIso = typeof hourlyDate === "string" ? hourlyDate : isoFromDate(hourlyDate);
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (hourlyDate && isSameDay(hourlyDate, today) && nowMin >= 23 * 60) {
      dateIso = isoFromDate(addDays(hourlyDate, 1));
    }
    const [h1, m1] = (hourlyStart || "08:00").split(":").map(Number);
    const [h2, m2] = (hourlyEnd || "12:00").split(":").map(Number);
    if ((h2 * 60 + m2) <= (h1 * 60 + m1)) {
      setErr(t("booking.err_end_after_start"));
      return;
    }
    const depPct = form.payment_method === "sepay" && paymentType === "deposit" ? (Number(form.deposit_percent) || 30) : 0;
    payload = {
      room_id: roomId,
      booking_type: "hourly",
      full_name: fullName,
      phone,
      email,
      check_in: dateIso,
      check_out: dateIso,
      check_in_time: hourlyStart,
      check_out_time: hourlyEnd,
      guests: Number(form.guests),
      note: form.note,
      payment_method: form.payment_method || "sepay",
      deposit_percent: depPct,
      remainder_payment_method: form.remainder_payment_method || "cash"
    };
  } else {
    if (!range.from || !range.to) {
      setErr(t("booking.err_choose_checkin"));
      return;
    }
    const check_in = isoFromDate(range.from);
    const check_out = isoFromDate(range.to);
    const depPct = form.payment_method === "sepay" && paymentType === "deposit" ? (Number(form.deposit_percent) || 30) : 0;
    payload = {
      room_id: roomId,
      booking_type: "overnight",
      full_name: fullName,
      phone,
      email,
      check_in,
      check_out,
      guests: Number(form.guests),
      note: form.note,
      payment_method: form.payment_method || "sepay",
      deposit_percent: depPct,
      remainder_payment_method: form.remainder_payment_method || "cash"
    };
  }

  try {
    const res = await createBooking(payload);
    const b = res.booking;

    // Lưu lookup_code để hiển thị trong block thanh toán (cash) hoặc dự phòng
    setForm(s => ({ ...s, _lookup_code: b?.lookup_code || "" }));

    // ✅ Thông báo đặt đơn thành công (chuông dropdown)
    if (b?.id) {
      addNotification({ type: "booking_success", bookingId: b.id, lookupCode: b.lookup_code || "" });
    }

    // ✅ Nếu chọn SePay => chuyển qua trang thanh toán luôn
    if (res.next_step === "PAY_WITH_SEPAY" && b?.id) {
      nav(`/payment/${b.id}`);
      return;
    }

    setOk(`Tạo booking thành công! Code: ${b.lookup_code}.`);
    setCreatedId(b.id);

  } catch (e2) {
    if (e2.message === "LOGIN_REQUIRED" || e2.message === "UNAUTHORIZED") {
      setErr(t("booking.err_login"));
    } else if (e2.message === "MISSING_FULL_NAME") {
      setErr(t("booking.err_required_full_name"));
    } else if (e2.message === "MISSING_PHONE") {
      setErr(t("booking.err_required_phone"));
    } else if (e2.message === "MISSING_EMAIL") {
      setErr(t("booking.err_required_email"));
    } else if (e2.message === "BOOKING_OVERLAP") {
      setErr(t("booking.err_overlap"));
    } else if (e2.message === "CHECKOUT_MUST_AFTER_CHECKIN" || e2.message === "INVALID_DATES") {
      setErr(t("booking.err_checkout_after"));
    } else if (e2.message === "INVALID_TIMES") {
      setErr(t("booking.err_invalid_times"));
    } else if (e2.message === "MIN_1_HOUR") {
      setErr(t("booking.err_min_1_hour"));
    } else if (e2.message === "PAST_DATE") {
      setErr(t("booking.err_past_date"));
    } else if (e2.message === "TODAY_AFTER_CHECKIN_TIME") {
      setErr(t("booking.err_today_after"));
    } else {
      setErr(`Lỗi: ${e2.message}`);
    }
  }
}


  const qrUrl = useMemo(() => {
    if (!bank?.bank_bin || !bank?.account_number) return "";
    if (!createdId) return "";
    if (form.payment_method !== "sepay") return "";
    const code = form._lookup_code;
    if (!code) return "";
    const addInfo = encodeURIComponent(`TT_${code}_B${createdId}`);
    const acc = encodeURIComponent(bank.account_number);
    const amt = encodeURIComponent(String(total || 0));
    const bin = encodeURIComponent(bank.bank_bin);
    return `https://img.vietqr.io/image/${bin}-${acc}-compact2.png?amount=${amt}&addInfo=${addInfo}&accountName=${encodeURIComponent(bank.account_name || "")}`;
  }, [bank, createdId, form.payment_method, form._lookup_code, total]);

  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <h1>{t("booking.title")}</h1>
          <p>{room ? `${room.name} • ${room.location}` : "..."}</p>
        </div>
        <button className="btn btn-ghost" onClick={() => nav("/")}>{t("booking.back_home")}</button>
      </div>

      {!me && (
        <div className="card2" style={{ marginBottom: 12 }}>
          <div className="section-title">{t("booking.not_logged_in")}</div>
          <div className="muted" style={{ marginTop: 6 }}>{t("booking.not_logged_in_hint")}</div>
          <div className="row" style={{ marginTop: 10 }}>
            <a className="btn btn-sm" href={`${BASE}/auth/google`}>{t("booking.login_google")}</a>
            <button className="btn btn-ghost btn-sm" onClick={() => nav("/booking-status")}>{t("booking.search_booking")}</button>
          </div>
        </div>
      )}

      {err && <p id="booking-form-error" className="error-message" role="alert">{err}</p>}
      {ok && <p style={{ color: "green", fontWeight: 900 }}>{ok}</p>}

      <div className="filters">
        <div className="card2">
          <div className="section-title">
            {isHourly ? t("booking.rent_hourly") : t("booking.choose_date")}
          </div>

          <div className="legend" style={{ marginBottom: 10 }}>
            <span><i className="dot pending" /> {t("booking.legend_pending")}</span>
            <span><i className="dot confirmed" /> {t("booking.legend_confirmed")}</span>
          </div>

          {isHourly ? (
            <>
              <div className="cal-wrap">
                <DayPicker
                  mode="single"
                  selected={hourlyDate}
                  onSelect={(d) => {
                    setHourlyDate(d || null);
                    if (d) {
                      const dateIso = isoFromDate(d);
                      fetchAvailability(roomId, null, dateIso).then(d => setHourlySlots(d.hourly_slots || [])).catch(()=>setHourlySlots([]));
                    }
                  }}
                  onMonthChange={setDisplayMonth}
                  month={displayMonth}
                  disabled={disabled}
                  modifiers={modifiers}
                  modifiersStyles={modifierStyles}
                  modifiersClassNames={{ weekend: "rdp-day_weekend", holiday: "rdp-day_holiday" }}
                  components={components}
                  onDayMouseEnter={(day, m, e) => {
                    setHoverDay(day);
                    showTooltip(day, e);
                  }}
                  onDayMouseLeave={() => { setHoverDay(null); hideTooltip(); }}
                  footer={
                    <div className="muted" style={{ marginTop: 8 }}>
                      {t("booking.day_selected")} <b>{hourlyDate ? fmtDDMMYYYYFromISO(isoFromDate(hourlyDate)) : "—"}</b>
                    </div>
                  }
                />
              </div>
              {hourlyDate && (
                <div className="row2" style={{ marginTop: 12, gap: 12 }}>
                  <div className="input">
                    <label>{t("booking.from_time")}</label>
                    <select
                      value={allowedStartOptions.includes(hourlyStart) ? hourlyStart : (allowedStartOptions[0] || hourlyStart)}
                      onChange={(e) => setHourlyStart(e.target.value)}
                      style={{ width:"100%", padding:"10px 12px", borderRadius:14, border:"1px solid rgba(15,23,42,.12)" }}
                    >
                      {allowedStartOptions.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="input">
                    <label>{t("booking.to_time")}</label>
                    <select
                      value={allowedEndOptions.includes(hourlyEnd) ? hourlyEnd : (allowedEndOptions[0] || hourlyEnd)}
                      onChange={(e) => setHourlyEnd(e.target.value)}
                      style={{ width:"100%", padding:"10px 12px", borderRadius:14, border:"1px solid rgba(15,23,42,.12)" }}
                    >
                      {allowedEndOptions.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              {hourlySlots.length > 0 && hourlyDate && (
                <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                  {t("booking.already_booked")} {hourlySlots.map(s => `${s.start}-${s.end}`).join(", ")}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="cal-wrap">
                <DayPicker
                  mode="range"
                  selected={range}
                  onSelect={onSelectRange}
                  onMonthChange={setDisplayMonth}
                  month={displayMonth}
                  disabled={disabled}
                  modifiers={modifiers}
                  modifiersStyles={modifierStyles}
                  modifiersClassNames={{ weekend: "rdp-day_weekend", holiday: "rdp-day_holiday" }}
                  components={components}
                  onDayMouseEnter={(day, m, e) => {
                    setHoverDay(day);
                    showTooltip(day, e);
                  }}
                  onDayMouseLeave={() => { setHoverDay(null); hideTooltip(); }}
                  footer={
                    <div className="muted" style={{ marginTop: 8 }}>
                      {t("booking.checkin")} <b>{range.from ? fmtDDMMYYYYFromISO(isoFromDate(range.from)) : "—"}</b> •
                      {" "}{t("booking.checkout")} <b>{range.to ? fmtDDMMYYYYFromISO(isoFromDate(range.to)) : "—"}</b>
                    </div>
                  }
                />

                {popover && (
                  <div
                    className="cal-popover"
                    style={{ left: popover.x, top: popover.y }}
                    ref={popRef}
                  >
                    <div className="t1">{popover.title}</div>
                    <div className="t2">{popover.desc}</div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="card2">
          <div className="section-title">{t("booking.form_title")}</div>

          <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
            <div className="row2">
              <div className="input">
                <label htmlFor="booking-full_name">{t("booking.full_name")} <span style={{ color: "red" }}>*</span></label>
                <input id="booking-full_name" value={form.full_name} onChange={(e) => setForm(s => ({ ...s, full_name: e.target.value }))} required aria-describedby={err ? "booking-form-error" : undefined} />
              </div>
              <div className="input">
                <label htmlFor="booking-phone">{t("booking.phone")} <span style={{ color: "red" }}>*</span></label>
                <input id="booking-phone" value={form.phone} onChange={(e) => setForm(s => ({ ...s, phone: e.target.value }))} required aria-describedby={err ? "booking-form-error" : undefined} />
              </div>
            </div>

            <div className="input">
              <label htmlFor="booking-email">{t("booking.email")} <span style={{ color: "red" }}>*</span></label>
              <input id="booking-email" type="email" value={form.email} onChange={(e) => setForm(s => ({ ...s, email: e.target.value }))} required aria-describedby={err ? "booking-form-error" : undefined} />
            </div>

            <div className="row2">
              <div className="input">
                <label>{t("booking.guests_label")}</label>
                <input type="number" min="1" value={form.guests} onChange={(e) => setForm(s => ({ ...s, guests: e.target.value }))} />
              </div>
            </div>

            <div className="input">
                  <label className="muted" style={{ display: "block", marginBottom: 8 }}>{t("booking.payment_method_label")}</label>
                  <div className="chips">
                    <button
                      type="button"
                      className={`chip ${paymentType === "full" ? "on" : ""}`}
                      onClick={() => setPaymentType("full")}
                    >
                      {t("booking.pay_full")}
                    </button>
                    <button
                      type="button"
                      className={`chip ${paymentType === "deposit" ? "on" : ""}`}
                      onClick={() => setPaymentType("deposit")}
                    >
                      {t("booking.pay_deposit")}
                    </button>
                  </div>
                </div>
                {paymentType === "deposit" && (
                  <div className="input">
                    <label className="muted" style={{ display: "block", marginBottom: 8 }}>{t("booking.deposit_percent_label")}</label>
                    <div className="chips">
                      {[20, 25, 30].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          className={`chip ${(form.deposit_percent || 30) === pct ? "on" : ""}`}
                          onClick={() => setForm(s => ({ ...s, deposit_percent: pct }))}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                )}

            <div className="input">
              <label>{t("booking.note")}</label>
              <input value={form.note} onChange={(e) => setForm(s => ({ ...s, note: e.target.value }))} />
            </div>

            <div className="card2 pay-summary-card">
              <div className="muted">{t("booking.total")}</div>
              <div className="pay-total-value">{formatMoney(Number(total || 0))}</div>
              {isHourly && hourlyDate && room && (
                <div className="muted" style={{ marginTop: 4 }}>
                  {(() => {
                    const [h1, m1] = (hourlyStart || "08:00").split(":").map(Number);
                    const [h2, m2] = (hourlyEnd || "12:00").split(":").map(Number);
                    const hours = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
                    return <>{hours} {t("booking.hours_times")} {formatMoney(Number(room.price_per_hour || 0))} / {t("common.per_hour")}</>;
                  })()}
                </div>
              )}
              {paymentType === "deposit" && (
                <div className="muted" style={{ marginTop: 6 }}>
                  {t("booking.deposit_equals")} <b>{(form.deposit_percent || 30)}%</b> ={" "}
                  <b>{formatMoney(Math.floor(total * ((form.deposit_percent || 30) / 100)))}</b>
                </div>
              )}
              {paymentType === "full" && (
                <div className="muted" style={{ marginTop: 6 }}>
                  {t("booking.deposit_equals_full")} <b>{formatMoney(Number(total || 0))}</b>
                </div>
              )}
              <div className="muted" style={{ marginTop: 6 }}>
                {isHourly ? t("booking.rent_hourly") : t("booking.checkin_checkout_hint")}
              </div>
            </div>

            <button className="btn" type="submit">{t("booking.submit")}</button>
          </form>

          {createdId && (
            <div className="card2 pay-summary-card" style={{ marginTop: 12 }}>
              <div className="pay-summary-title">{t("booking.payment_section")}</div>
              <div className="muted" style={{ marginTop: 6 }}>
                {t("booking.booking_code")} <b>#{createdId}</b> • Code: <b>{form._lookup_code}</b>
              </div>

              <div className="muted" style={{ marginTop: 10 }}>
                {t("booking.transfer_content")} <b>{`TT_${form._lookup_code}_B${createdId}`}</b>
              </div>
              {bank && (
                <div className="muted" style={{ marginTop: 6 }}>
                  {bank.bank_name} • {bank.account_name} • {bank.account_number}
                </div>
              )}
              {!!qrUrl && (
                <div className="pay-qr" style={{ marginTop: 12 }}>
                  <img src={qrUrl} alt="QR" />
                  <div className="muted" style={{ textAlign: "center" }}>
                    {t("booking.scan_qr_hint")}
                  </div>
                </div>
              )}

              <div className="row" style={{ marginTop: 10, flexWrap: "wrap", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => nav("/booking-status")}>{t("booking.search_status")}</button>
                <button type="button" className="btn-share" onClick={() => setShareOpen(true)}>
                  🔗 {t("share.share_with_friends")}
                </button>
              </div>
            </div>
          )}
          <ShareDropdown open={shareOpen} onClose={() => setShareOpen(false)} url={`/room/${roomId}`} />
        </div>
      </div>
    </div>
  );
}
