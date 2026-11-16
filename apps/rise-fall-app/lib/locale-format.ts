/**
 * `Intl` formatter instances keyed by locale and options. Tick displays and
 * digit statistics format on every tick and the end-time picker formats on
 * every render, so each formatter is built once per (locale, digits) rather
 * than on each call.
 *
 * Only ES2015 `Intl` options are used (`style`, fraction digits), so every
 * engine in Next 14's default browserslist (Safari 12+) formats the same way:
 * `signDisplay` (ES2020) and `style: 'unit'` are deliberately avoided, since
 * older engines ignore the first (no `+` on gains, `-0.00` on breakeven) and
 * throw on the second. Signs are added here from the rounded value instead.
 */
const numberFormats = new Map<string, Intl.NumberFormat>();
const percentSuffixes = new Map<string, string>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

function numberFormat(locale: string, digits: number): Intl.NumberFormat {
  const key = `${locale}|${digits}`;
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, {
      style: 'decimal',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    numberFormats.set(key, format);
  }
  return format;
}

/**
 * What the locale's `style: 'percent'` formatter prints after the number
 * (`%` in en/pt, a no-break space and `%` in es/fr): the text after the last
 * digit of `format(1)` (`'100 %'` → `' %'`), read once per locale. Plain
 * `format` is ES2015; `formatToParts` would be cleaner but only arrived in
 * Safari 13. Appending the suffix to the decimal formatter's output gives the
 * exact percent-style text without dividing by 100 first, whose binary result
 * can round a half-way percentage (`0.15` → `0.2%`) differently from the
 * decimal formatter and the previous `toFixed` output.
 */
function percentSuffix(locale: string): string {
  let suffix = percentSuffixes.get(locale);
  if (suffix === undefined) {
    const sample = new Intl.NumberFormat(locale, { style: 'percent' }).format(1);
    suffix = /\d([^\d]*)$/.exec(sample)?.[1] ?? '%';
    percentSuffixes.set(locale, suffix);
  }
  return suffix;
}

/** True when the formatted text shows a non-zero digit: a zero has none in any supported language. */
const hasNonZeroDigit = (text: string) => /[1-9]/.test(text);

/**
 * `|value|` with exactly `digits` fraction digits and the locale's grouping,
 * plus whether it rounded to zero. Formatting the magnitude keeps the sign
 * decision in one place (`signOf`), independent of any `Intl` sign option.
 */
function magnitude(value: number, digits: number, locale: string): { text: string; isZero: boolean } {
  const text = numberFormat(locale, digits).format(Math.abs(value));
  return { text, isZero: !hasNonZeroDigit(text) };
}

/**
 * The one sign rule. `value` at `digits` fraction digits as `{ text, sign }`:
 * `sign` is `'+'`, `'-'`, or `''` when the magnitude rounds to zero there
 * (`-0.004` at 2 digits → `''`, `-0.005` → `'-'`, matching `Intl`'s
 * half-away-from-zero rounding of the text), and `text` is the magnitude with
 * that sign in front, `+` included only when `plus` is set (the P&L form).
 * `NaN` and infinities have no sign and print as `Intl` prints them.
 */
function signedText(value: number, digits: number, locale: string, plus: boolean): { text: string; sign: '+' | '-' | '' } {
  if (!Number.isFinite(value)) return { text: numberFormat(locale, digits).format(value), sign: '' };
  const { text, isZero } = magnitude(value, digits, locale);
  const sign = isZero ? '' : value < 0 ? '-' : '+';
  const shown = sign === '-' || (sign === '+' && plus) ? sign : '';
  return { text: `${shown}${text}`, sign };
}

/** The sign `value` carries once shown at `digits` fraction digits (see `signedText`). */
export function roundedSign(value: number, digits: number): '+' | '-' | '' {
  return signedText(value, digits, 'en', false).sign;
}

/** Minus on negatives only; zero (including `-0` and values rounding to zero) unsigned. */
function formatNumber(value: number, digits: number, locale: string): string {
  return signedText(value, digits, locale, false).text;
}

/** `+` on gains, `-` on losses, nothing on zero: the P&L form. */
function formatSignedNumber(value: number, digits: number, locale: string): string {
  return signedText(value, digits, locale, true).text;
}

/**
 * Numeric API strings such as `'10.00'` parse strictly with `Number()`. A blank
 * string is not an amount and stays visibly invalid (`NaN`), as the previous
 * `parseFloat`-then-fixed-decimals code did, rather than reading as `0.00`.
 * Shared with `lib/position-amounts.ts` so every row parses one way.
 */
export function parseAmount(value: number | string): number {
  return typeof value === 'string' && value.trim() === '' ? NaN : Number(value);
}

/** Rounds a quote to the pip size exactly as the digit logic does (`toFixed`). */
function roundTick(quote: number, pipSize: number): number {
  return Number(quote.toFixed(pipSize));
}

/** Monetary amount with two decimals; accepts numeric API strings such as `'10.00'`. */
export function formatAmount(value: number | string, locale: string): string {
  return formatNumber(parseAmount(value), 2, locale);
}

/**
 * Account balance for the header: an account can arrive with `balance: ''`
 * before it is populated, and the header has always shown that as `0.00`, never
 * `NaN`. This is the one place a blank amount string reads as zero ([LNF-001]
 * exempts it); every other amount keeps `formatAmount`'s visibly-invalid `NaN`.
 * The accounts response is not validated at runtime, so a numeric balance is
 * tolerated too, and a missing (`null`/`undefined`) one reads `NaN`: that is an
 * account with no balance field at all, not an unpopulated one.
 */
export function formatBalance(balance: string | number | null | undefined, locale: string): string {
  if (balance == null) return formatAmount(NaN, locale);
  const value = typeof balance === 'string' && balance.trim() === '' ? 0 : Number(balance);
  return formatAmount(value, locale);
}

/** Profit/loss amount with its sign: `+1.50`, `-1.50`, and `0.00` for zero (including `-0`). */
export function formatSignedAmount(value: number | string, locale: string): string {
  return formatSignedNumber(parseAmount(value), 2, locale);
}

/** Market price with `pipSize` fraction digits. */
export function formatPrice(value: number, pipSize: number, locale: string): string {
  return formatNumber(value, pipSize, locale);
}

/**
 * A displayed spot or tick price. Every quote a user reads (Rise/Fall current
 * price, Digits tick, symbol-selector spot) rounds with `toFixed(pipSize)`
 * first, exactly as the digit logic does, and only then localises: `Intl` rounds
 * the shortest decimal form instead, so a quote with more decimals than
 * `pipSize` (1.005 at pipSize 2: `toFixed` → "1.00", `Intl` → "1.01") would
 * otherwise show two different last digits on one screen, or disagree with
 * the Last Digit badge.
 */
export function formatTickPrice(quote: number, pipSize: number, locale: string): string {
  return formatPrice(roundTick(quote, pipSize), pipSize, locale);
}

/**
 * Direction of a price move as the user sees it: compares the two quotes as
 * they print (`formatTickPrice` rounding), not their raw difference, so a move
 * that changes the printed price always shows an arrow (1.004 → 1.006 at pip
 * size 2 prints `1.00` → `1.01`: `'+'`) and one that does not never does
 * (1.0051 → 1.0149 both print `1.01`: `''`).
 */
export function tickChangeSign(current: number, previous: number, pipSize: number): '+' | '-' | '' {
  const delta = tickDelta(current, previous, pipSize);
  return delta > 0 ? '+' : delta < 0 ? '-' : '';
}

/**
 * The difference between two quotes as they print at `pipSize` (`1.006 - 1.004`
 * at 2 → `0.01`, `1.0149 - 1.0051` → `0`), so a displayed change and its sign
 * always agree with the displayed spot. `NaN` when either quote is not finite.
 */
export function tickDelta(current: number, previous: number, pipSize: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return NaN;
  return roundTick(current, pipSize) - roundTick(previous, pipSize);
}

/** Whole-number count (ticks, positions) with the locale's grouping and no decimals. */
export function formatInteger(value: number, locale: string): string {
  return formatNumber(value, 0, locale);
}

/** Percentage given in percent units (8 → `8%` / `8 %`) with fixed fraction digits. */
export function formatPercent(percent: number, fractionDigits: number, locale: string): string {
  return `${formatNumber(percent, fractionDigits, locale)}${percentSuffix(locale)}`;
}

/** Profit/loss percentage with its sign: `+0.2%`, `-0.2%`, and `0.0%` for zero (including `-0`). */
export function formatSignedPercent(percent: number, fractionDigits: number, locale: string): string {
  return `${formatSignedNumber(percent, fractionDigits, locale)}${percentSuffix(locale)}`;
}

/** Accumulators growth rate given as a fraction (0.01 → `1%` / `1 %`). */
export function formatGrowthRate(rate: number, locale: string): string {
  return formatPercent(rate * 100, 0, locale);
}

/**
 * Whether an amount reads as a gain once shown at two decimals: `true` for `0`,
 * `-0` and `-0.004` (all render as an unsigned `0.00`), `false` for `-0.005`
 * (renders `-0.01`). `NaN` is not a gain.
 */
export function isGainAmount(value: number | string): boolean {
  const amount = parseAmount(value);
  return Number.isFinite(amount) && roundedSign(amount, 2) !== '-';
}

/** `isGainAmount` for a percentage shown with `fractionDigits`, matching `formatSignedPercent`. */
export function isGainPercent(percent: number, fractionDigits: number): boolean {
  return Number.isFinite(percent) && roundedSign(percent, fractionDigits) !== '-';
}

/**
 * The one gain/loss rule for every profit display (position rows and cards,
 * Accumulators Current P&L, chart markers): a position is a loss when its amount
 * (shown at 2 decimals) or its percentage (shown at 1) prints negative, so a
 * sub-cent loss on a small stake is coloured the same everywhere, whether or not
 * the percentage is printed beside it. A percentage that is not a finite number
 * (a closed position bought for 0) is ignored and the amount alone decides.
 */
export function isGainPosition(profit: number | string, profitPercent: number): boolean {
  return isGainAmount(profit) && (!Number.isFinite(profitPercent) || isGainPercent(profitPercent, 1));
}

/**
 * A closed position's profit percentage, shared by the closed row and the
 * closed card so both colour and print it identically; `NaN` (not shown) when
 * the position was bought for 0.
 */
export function closedPositionProfitPercent(buyPrice: number, sellPrice: number): number {
  return buyPrice > 0 ? ((sellPrice - buyPrice) / buyPrice) * 100 : NaN;
}

/**
 * API barrier percentage such as `'0.04048%'` as `±` + percent with the API's
 * precision. Whitespace, a `%` and a `±` are ignored and a leading `.` is
 * accepted; `''` when what remains is not a plain decimal number, so a malformed
 * value hides the row rather than rendering `NaN`. Fraction digits are capped at
 * `Intl`'s limit of 20. The proposal payload is not validated at runtime, so a
 * numeric value is accepted as its decimal string and anything else (null,
 * undefined, an object) is `''`, like `formatBarrier`.
 */
export function formatBarrierPercent(apiValue: string | number | null | undefined, locale: string): string {
  if (typeof apiValue !== 'string' && typeof apiValue !== 'number') return '';
  const numeric = String(apiValue).replace(/[\s±%]/g, '');
  if (!/^\d*\.?\d+$/.test(numeric)) return '';
  const fractionDigits = Math.min(numeric.split('.')[1]?.length ?? 0, 20);
  return `±${formatPercent(Number(numeric), fractionDigits, locale)}`;
}

/**
 * API contract barrier as shown next to the contract type: absolute (`'1234.56'`),
 * relative (`'+0.12'`, sign kept) or digit (`'5'`) barriers are localised with the
 * API string's own precision (capped at `Intl`'s 20 fraction digits, as
 * `formatBarrierPercent` does); any other string is shown as the API sent it, and
 * a missing or non-string value (the schema allows `null`) is `''`.
 */
export function formatBarrier(apiValue: string | null | undefined, locale: string): string {
  if (typeof apiValue !== 'string') return '';
  const match = /^([+-]?)(\d+(?:\.(\d+))?)$/.exec(apiValue.trim());
  if (!match) return apiValue;
  const [, sign, number, fraction] = match;
  return `${sign}${formatPrice(Number(number), Math.min(fraction?.length ?? 0, 20), locale)}`;
}

/** Date as numeric day, short month and numeric year in the locale's order. */
export function formatDate(date: Date, locale: string): string {
  let format = dateFormats.get(locale);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    dateFormats.set(locale, format);
  }
  return format.format(date);
}
