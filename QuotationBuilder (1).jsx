import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, FileText, X, Printer } from 'lucide-react';

const CATEGORIES = [
  { id: 'putty',        label: 'Putty',                          unit: 'Bag',   defaultQty: 120, color: 'amber'  },
  { id: 'ext_primer',   label: 'Exterior Primer',                unit: 'Litre', defaultQty: 100, color: 'sky'    },
  { id: 'int_primer',   label: 'Interior Primer',                unit: 'Litre', defaultQty: 200, color: 'violet' },
  { id: 'wp_undercoat', label: 'Waterproof Undercoat (Int/Ext)', unit: 'Litre', defaultQty: 0,   color: 'cyan'   },
  { id: 'topcoat_ext',  label: 'Exterior Topcoat',               unit: 'Litre', defaultQty: 0,   color: 'orange' },
  { id: 'topcoat_int',  label: 'Interior Topcoat',               unit: 'Litre', defaultQty: 0,   color: 'rose'   },
  { id: 'waterproof',   label: 'Waterproofing',                  unit: 'Litre', defaultQty: 0,   color: 'teal'   },
  { id: 'other',        label: 'Other',                          unit: 'Unit',  defaultQty: 0,   color: 'slate'  },
];

const COLORS = {
  amber:  { border: 'border-amber-400',  dot: 'bg-amber-400'  },
  sky:    { border: 'border-sky-400',    dot: 'bg-sky-400'    },
  violet: { border: 'border-violet-400', dot: 'bg-violet-400' },
  cyan:   { border: 'border-cyan-400',   dot: 'bg-cyan-400'   },
  orange: { border: 'border-orange-400', dot: 'bg-orange-400' },
  rose:   { border: 'border-rose-400',   dot: 'bg-rose-400'   },
  teal:   { border: 'border-teal-400',   dot: 'bg-teal-400'   },
  slate:  { border: 'border-slate-400',  dot: 'bg-slate-400'  },
};

const STOCK_OPTIONS = [
  { id: 'unknown',   label: 'Stock: not checked',         cls: 'bg-stone-100 text-stone-500'    },
  { id: 'available', label: 'Stock: available',           cls: 'bg-emerald-100 text-emerald-700' },
  { id: 'check',     label: 'Stock: verify with Finance', cls: 'bg-amber-100 text-amber-700'    },
  { id: 'out',       label: 'Stock: out of stock',        cls: 'bg-red-100 text-red-700'        },
];

const TERMS = [
  'Prices are subject to change without prior notice as per company circulars.',
  'This quotation is valid for 15 days from the date of issue.',
  'GST will be charged extra as applicable at the time of billing.',
  'Payment terms as mutually agreed before material dispatch.',
  'Delivery is subject to stock availability at the depot.',
];

const getCat = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

const fmt = (n) =>
  isFinite(n)
    ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';

const plural = (unit, qty) => (parseFloat(qty) !== 1 ? unit + 's' : unit);

// ─── CORRECT FORMULA (matches calculator screenshot) ──────────────────────────
// Step 1: Base          = DPL − (Rebate per L/Kg × Pack Size)
// Step 2: After GST     = Base × (1 + GST% / 100)
// Step 3: After Margin  = After GST × (1 + Margin% / 100)
// Step 4: finalPerPack  = After Margin × (1 − Discount% / 100)
// Step 5: displayRate   = finalPerPack / packSizeNum  ← per litre or per kg
//         (for Bag unit: displayRate = finalPerPack, qty is in bags)
// Step 6: ratePerSqft   = displayRate / coverageNum
// Step 7: lineTotal     = displayRate × quantity
// Example: 1000−40×8+18%+7%−5% = 815.6396 ✓
// ─────────────────────────────────────────────────────────────────────────────
const calc = (item) => {
  const dpl         = parseFloat(item.dpl)         || 0;
  const rebatePerU  = parseFloat(item.rebatePerU)  || 0;
  const packSizeNum = parseFloat(item.packSizeNum) || 1;
  const gst         = parseFloat(item.gst)         || 0;
  const margin      = parseFloat(item.margin)      || 0;
  const discount    = parseFloat(item.discount)    || 0;
  const qty         = parseFloat(item.quantity)    || 0;
  const coverageNum = parseFloat(item.coverageNum) || 0;

  const rebateDeduction = rebatePerU * packSizeNum;
  const base        = dpl - rebateDeduction;
  const afterGST    = base        * (1 + gst     / 100);
  const afterMargin = afterGST    * (1 + margin  / 100);
  const finalPerPack= afterMargin * (1 - discount / 100);

  // Display rate: ALWAYS per kg or per litre (Rate/pack ÷ pack size)
  // e.g. ₹1160 bag ÷ 40 kg = ₹29/kg
  const displayRate = finalPerPack / packSizeNum;

  // Rate/sqft = Rate per kg (or per litre) ÷ coverage
  // e.g. ₹29/kg ÷ 10 sqft/kg = ₹2.9/sqft
  const ratePerSqft = coverageNum > 0 ? displayRate / coverageNum : 0;

  // Line total:
  // Bag  → qty is in bags  → finalPerPack × bags
  // Litre→ qty is in litres→ displayRate  × litres
  const isPerBag  = item.unit === 'Bag';
  const lineTotal = isPerBag ? finalPerPack * qty : displayRate * qty;

  return { rebateDeduction, base, afterGST, afterMargin, finalPerPack, displayRate, ratePerSqft, lineTotal };
};

const BLANK_PRODUCT  = { name: '', sku: '', category: 'putty', packSize: '', packSizeNum: '', dplRate: '', coverage: '', coverageNum: '', warranty: '', colour: 'White' };
const BLANK_CUSTOMER = { name: '', site: '', location: '', contact: '', dealer: '' };
const BLANK_DEFAULTS = { gst: '18', rebatePerU: '0', margin: '0', discount: '0' };

export default function QuotationBuilder() {
  const [tab,          setTab]          = useState('quote');
  const [loading,      setLoading]      = useState(true);
  const [catalog,      setCatalog]      = useState([]);
  const [items,        setItems]        = useState([]);
  const [customer,     setCustomer]     = useState(BLANK_CUSTOMER);
  const [defaults,     setDefaults]     = useState(BLANK_DEFAULTS);
  const [showDefaults, setShowDefaults] = useState(false);
  const [showAddProd,  setShowAddProd]  = useState(false);
  const [newProd,      setNewProd]      = useState(BLANK_PRODUCT);
  const [expanded,     setExpanded]     = useState(null);
  const [showPicker,   setShowPicker]   = useState(false);
  const [showPreview,  setShowPreview]  = useState(false);
  const [quotationRef, setQuotationRef] = useState('');

  const openPreview = () => {
    if (!quotationRef) {
      const y = new Date().getFullYear();
      const s = (y + 1).toString().slice(2);
      const n = Math.floor(Math.random() * 8999) + 1000;
      setQuotationRef(`BPLI/TSR/np/${y}–${s}/${n}`);
    }
    setShowPreview(true);
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get('bpli_catalog', false);
        if (r && r.value) setCatalog(JSON.parse(r.value));
      } catch (e) {}
      try {
        const r = await window.storage.get('bpli_defaults', false);
        if (r && r.value) setDefaults(JSON.parse(r.value));
      } catch (e) {}
      setLoading(false);
    })();
  }, []);

  const saveCatalog = async (v) => {
    setCatalog(v);
    try { await window.storage.set('bpli_catalog', JSON.stringify(v), false); } catch (e) {}
  };
  const saveDefaults = async (v) => {
    setDefaults(v);
    try { await window.storage.set('bpli_defaults', JSON.stringify(v), false); } catch (e) {}
  };

  const saveProd = () => {
    if (!newProd.name.trim() || !newProd.sku.trim()) return;
    if (newProd.id) {
      saveCatalog(catalog.map((p) =>
        p.id === newProd.id
          ? { ...newProd, name: newProd.name.trim(), sku: newProd.sku.trim() }
          : p
      ));
    } else {
      saveCatalog([
        ...catalog,
        { ...newProd, id: Date.now().toString(), name: newProd.name.trim(), sku: newProd.sku.trim() },
      ]);
    }
    setNewProd({ ...BLANK_PRODUCT, category: newProd.category });
    setShowAddProd(false);
  };

  const editProd   = (p) => { setNewProd({ ...p }); setShowAddProd(true); };
  const cancelEdit = ()  => { setNewProd({ ...BLANK_PRODUCT, category: newProd.category }); setShowAddProd(false); };
  const delProd    = (id, e) => { e.stopPropagation(); saveCatalog(catalog.filter((p) => p.id !== id)); };

  const addItem = (product) => {
    const cat = getCat(product.category);
    const newItem = {
      id:          Date.now().toString() + Math.random().toString(36).slice(2, 6),
      name:        product.name,
      sku:         product.sku,
      packSize:    product.packSize    || '',
      packSizeNum: product.packSizeNum || '',
      category:    product.category,
      unit:        cat.unit,
      quantity:    cat.defaultQty,
      dpl:         product.dplRate !== undefined && product.dplRate !== '' ? product.dplRate : '',
      rebatePerU:  defaults.rebatePerU,
      gst:         defaults.gst,
      margin:      defaults.margin,
      discount:    defaults.discount,
      stockStatus: 'unknown',
      coverage:    product.coverage    || '',
      coverageNum: product.coverageNum || '',
      warranty:    product.warranty    || '',
      colour:      product.colour      || 'White',
    };
    setItems((prev) => [...prev, newItem]);
    setShowPicker(false);
    setExpanded(newItem.id);
  };

  const upd = (id, field, val) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: val } : it)));
  const rem = (id) => setItems((prev) => prev.filter((it) => it.id !== id));

  const grandTotal = items.reduce((s, it) => s + calc(it).lineTotal, 0);
  const grouped    = items.reduce((acc, it) => {
    (acc[it.category] = acc[it.category] || []).push(it);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-400 text-sm">
        Loading…
      </div>
    );
  }

  // ── PRINT PREVIEW ─────────────────────────────────────────────────────────────
  if (showPreview) {
    const thStyle = { padding: '4px 6px', textAlign: 'center', borderRight: '1px solid #d6d3d1', fontWeight: 600 };
    const tdC     = { padding: '4px 6px', textAlign: 'center', borderRight: '1px solid #e7e5e4' };
    const tdL     = { padding: '4px 6px', textAlign: 'left',   borderRight: '1px solid #e7e5e4' };
    const tdR     = { padding: '4px 6px', textAlign: 'right',  borderRight: '1px solid #e7e5e4' };

    const CONDITIONS = [
      { text: 'The above quoted prices are inclusive of current taxes @ 18%.', hi: true },
      { text: 'This price is especially for your particular projects only and its valid upto next price revision.', hi: false },
      { text: 'Payments are to be made against receipt of materials at site.', hi: false },
      { text: 'Colorant Cost will be added with above base or white rate.', hi: true },
      { text: 'Orders should be routed through the concern Prolinks officer only.', hi: false },
      { text: 'The materials will be supplied through any of our Color Bank dealers.', hi: false },
      { text: 'Coverage area and square feet rate depends on the surface, shade and application is subject to change.', hi: false },
      { text: 'For any further clarifications please feel free to talk to us.', hi: false },
    ];
    const PROLINKS_BULLETS = [
      'Recommends Suitable Products, Painting System and application Procedures.',
      'Technical Support in Providing Solutions to overcome typical paint / Painting related problems.',
      'Product and shade development that would be suitable for specific requirements of project Customers.',
      'Identifies new innovations in paint application and makes them available to contractors through workshops and meets.',
      "Color consultancy and previews / makeup's / sampling at site.",
      'On request will provide onsite inspection to ensure painting system and application procedure.',
    ];
    const BERGER_LOGO = "data:image/jpeg;base64,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";
    const BergerLogo = ({ h }) => (
      <img src={BERGER_LOGO} alt="Berger Paints" style={{ height: h, width: 'auto', objectFit: 'contain' }} />
    );
    const Footer = () => (
      <div style={{ borderTop: '1px solid #d6d3d1', paddingTop: 8, marginTop: 16, textAlign: 'center', fontSize: 9 }}>
        <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 2 }}>BERGER PAINTS INDIA LIMITED</div>
        <div>Door No. III/835 – C, First Floor, Valiyara Chambers, K.K. Road, Chembumukku, Cochin - 682 021</div>
        <div>Phone – 0484 – 2426312, 2426318, 2424304. CIN – L51434WBI923PLC004793</div>
        <div>E-Mail: consumerfeedback@bergerindia.com, cochin@bergerindia.com, Web: www.bergerpaints.com</div>
      </div>
    );
    return (
      <div style={{ background: '#fff', fontFamily: 'sans-serif', color: '#1c1917', fontSize: 11 }}>

        {/* Toolbar */}
        <div className="print:hidden sticky top-0 z-10 flex justify-between items-center px-4 py-3 bg-stone-900 text-white">
          <span className="font-semibold text-sm">Quotation Preview</span>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-1 bg-emerald-600 px-3 py-1.5 rounded text-xs font-medium">
              <Printer size={14} /> Print / Save PDF
            </button>
            <button onClick={() => setShowPreview(false)} className="px-2 py-1.5 rounded text-xs border border-stone-600">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── PAGE 1 : INTRO LETTER ── */}
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 32px 32px' }}>
          <div style={{ height: 14, background: '#6b21a8', margin: '0 -32px 20px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <BergerLogo h={80} />
            <div style={{ textAlign: 'right', lineHeight: 1.5 }}>
              <div style={{ fontWeight: 600 }}>{quotationRef}</div>
              <div>Dated {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
            </div>
          </div>

          <div style={{ marginBottom: 20, lineHeight: 1.7 }}>
            <div>To</div>
            <div style={{ fontWeight: 700 }}>{customer.name || '[Customer / Company Name]'}</div>
            {customer.site     && <div>{customer.site}</div>}
            {customer.location && <div>{customer.location}</div>}
          </div>

          <div style={{ fontWeight: 700, marginBottom: 8 }}>Sir/Madam</div>

          <div style={{ marginBottom: 20, lineHeight: 1.7 }}>
            <strong>Sub. </strong>Hereby submitting the Project Rate for Painting from Berger Paints India Ltd – PROLINKS DIVISION
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20, lineHeight: 1.7, textAlign: 'justify' }}>
            <p style={{ margin: 0 }}>Welcome to the world of Berger Paints where we turn your dreams into colorful reality. With an unmatched range of products and services, Berger Paints India Ltd is a leader in paints, offering its customers a variety of innovative painting solutions, to be it decorative or industrial.</p>
            <p style={{ margin: 0 }}>Whether it is your home or office, your shop or factory, interiors or exteriors, metal, wood, plastic or any other surface - we have a paint solution for it! With an ever-evolving profile and rich history, Berger Paints India Ltd. (an ISO 9001 Company) has come a long way in the highly competitive Indian paints industry. At Berger we believe in taking paints to the level of fine art, enriched by the imagination of Lewis Berger since 1760.</p>
            <p style={{ margin: 0 }}>The Country's second largest decorative paint player, Berger is headquartered in Calcutta and services the market through a distribution network comprising of 82 stock points and 12,000+ paint retailers.</p>
          </div>

          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 900, fontSize: 16, color: '#1e3a8a', letterSpacing: '0.05em' }}>BERGER PROLINKS</span>
          </div>

          <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 5, lineHeight: 1.6 }}>
            {PROLINKS_BULLETS.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 8 }}>
                <span style={{ color: '#57534e', flexShrink: 0 }}>➤</span>
                <span>{b}</span>
              </div>
            ))}
          </div>

          <p style={{ textAlign: 'justify', lineHeight: 1.7, marginBottom: 24 }}>
            We know how important it is to promote uncompromising quality products and keep relationships alive. Our Management philosophy has always been to deliver the goods and in the process we try to reinstate our commitments to people like you. As desired by you, we are furnishing below our special project rates for the following products for your reference.
          </p>

          <Footer />
        </div>

        {/* ── PAGE 2+ : PRODUCT TABLES ── */}
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 32px 32px' }} className="print:break-before-page">
          <div style={{ height: 14, background: '#6b21a8', margin: '0 -32px 16px' }} />
          <BergerLogo h={70} />
          <div style={{ marginBottom: 16 }} />

          {items.length === 0 && <div style={{ textAlign: 'center', color: '#a8a29e', padding: 40 }}>No items added.</div>}

          {Object.entries(grouped).map(([catId, catItems]) => {
            const cat         = getCat(catId);
            const totalQty    = catItems.reduce((s, it) => s + (parseFloat(it.quantity) || 0), 0);
            const totalAmt    = catItems.reduce((s, it) => s + calc(it).lineTotal, 0);
            const hasWarranty = catItems.some((it) => it.warranty);
            const hasCoverage = catItems.some((it) => it.coverageNum);
            const extraCols   = (hasCoverage ? 2 : 0) + (hasWarranty ? 1 : 0);
            const totalCols   = 7 + extraCols;
            return (
              <div key={catId} style={{ marginBottom: 20 }}>
                <div style={{ background: '#292524', color: '#fff', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 8px', textAlign: 'center' }}>
                  {cat.label}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, border: '1px solid #d6d3d1' }}>
                  <thead>
                    <tr style={{ background: '#fef08a', color: '#292524', borderBottom: '1px solid #a8a29e' }}>
                      <th style={thStyle}>SL NO</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Material</th>
                      <th style={thStyle}>SKU</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Rate/Pack</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Rate/{cat.unit === 'Bag' ? 'Kg' : 'Ltr'}</th>
                      <th style={thStyle}>Colour</th>
                      {hasCoverage && <th style={thStyle}>Coverage</th>}
                      {hasCoverage && <th style={{ ...thStyle, textAlign: 'right' }}>Rate/Sqft</th>}
                      {hasWarranty && <th style={thStyle}>Warranty</th>}
                      <th style={{ ...thStyle, textAlign: 'right' }}>Qty</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catItems.map((it, idx) => {
                      const c = calc(it);
                      return (
                        <tr key={it.id} style={{ background: idx % 2 === 0 ? '#fff' : '#fafaf9', borderBottom: '1px solid #e7e5e4' }}>
                          <td style={tdC}>{idx + 1}</td>
                          <td style={{ ...tdL, fontWeight: 600 }}>
                            {it.name}{it.packSize ? <span style={{ fontWeight: 400, color: '#78716c' }}> ({it.packSize})</span> : null}
                          </td>
                          <td style={tdC}>{it.packSizeNum || '—'}</td>
                          <td style={tdR}>{fmt(c.finalPerPack)}</td>
                          <td style={{ ...tdR, fontWeight: 700 }}>{fmt(c.displayRate)}</td>
                          <td style={tdC}>{it.colour || 'White'}</td>
                          {hasCoverage && <td style={tdC}>{it.coverage || '—'}</td>}
                          {hasCoverage && <td style={{ ...tdR, color: '#047857', fontWeight: 700 }}>{c.ratePerSqft > 0 ? fmt(c.ratePerSqft) : '—'}</td>}
                          {hasWarranty && <td style={{ ...tdC, color: '#7e22ce' }}>{it.warranty || '—'}</td>}
                          <td style={tdR}>{it.quantity} {it.unit}</td>
                          <td style={{ ...tdR, fontWeight: 700 }}>{fmt(c.lineTotal)}</td>
                        </tr>
                      );
                    })}
                    <tr style={{ background: '#fef9c3', fontWeight: 700, borderTop: '2px solid #a8a29e' }}>
                      <td colSpan={totalCols - 1} style={{ ...tdL, padding: '6px 8px' }}>
                        Total {cat.unit === 'Bag' ? 'Bags' : 'Litres'} Required : {totalQty} {cat.unit === 'Bag' ? 'Bags' : 'Litres'}
                      </td>
                      <td style={{ ...tdR, padding: '6px 8px' }}>₹{fmt(totalAmt)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}

          {items.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', background: '#1c1917', color: '#fff', padding: '8px 12px', borderRadius: 4, fontWeight: 700, fontSize: 13, marginBottom: 20 }}>
              <span>GRAND TOTAL</span>
              <span>₹{fmt(grandTotal)}</span>
            </div>
          )}

          {/* Conditions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 16, lineHeight: 1.6 }}>
            {CONDITIONS.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 6 }}>
                <span style={{ color: c.hi ? '#ca8a04' : '#78716c', flexShrink: 0 }}>●</span>
                <span style={{ background: c.hi ? '#fef9c3' : 'transparent', padding: c.hi ? '0 4px' : 0, borderRadius: 2, fontWeight: c.hi ? 600 : 400 }}>
                  {c.text}
                </span>
              </div>
            ))}
          </div>

          <p style={{ textAlign: 'justify', lineHeight: 1.7, marginBottom: 20 }}>
            We hope the above rates are acceptable to you and favor us with your esteemed order. Assuring you of our best services at all times. If you want any further clarification about our products or services, please feel free to speak to the under signed.
          </p>

          <div style={{ lineHeight: 1.8 }}>
            <div>Thanking you, yours faithfully,</div>
            <div style={{ fontWeight: 700, marginTop: 8 }}>For BERGER PAINTS INDIA LTD</div>
            <div style={{ marginTop: 20, fontWeight: 700 }}>Sunish Konikkara</div>
            <div>ASM - Prolinks · 9072345679 / 9846986647</div>
            <div>suneeshkonikara@bergerindia.com</div>
          </div>

          <div style={{ marginTop: 20 }}><BergerLogo h={70} /></div>
          <Footer />
        </div>
      </div>
    );
  }

  // ── MAIN APP ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-stone-50 pb-24 font-sans">
      <div className="bg-stone-900 text-stone-50 px-4 py-3">
        <h1 className="font-semibold text-base">Quotation Builder</h1>
        <p className="text-stone-400 text-xs">Berger Project Sales — Thrissur</p>
      </div>

      {/* TABS */}
      <div className="flex border-b border-stone-200 bg-white sticky top-0 z-10">
        <button
          onClick={() => setTab('quote')}
          className={
            tab === 'quote'
              ? 'flex-1 py-3 text-sm font-medium text-emerald-700 border-b-2 border-emerald-600'
              : 'flex-1 py-3 text-sm font-medium text-stone-400'
          }
        >
          Quotation
        </button>
        <button
          onClick={() => setTab('catalog')}
          className={
            tab === 'catalog'
              ? 'flex-1 py-3 text-sm font-medium text-emerald-700 border-b-2 border-emerald-600'
              : 'flex-1 py-3 text-sm font-medium text-stone-400'
          }
        >
          Catalog ({catalog.length})
        </button>
      </div>

      {/* ── QUOTATION TAB ── */}
      {tab === 'quote' && (
        <div className="p-3 space-y-3">

          {/* Customer Details */}
          <div className="bg-white rounded-lg p-3 shadow-sm border border-stone-100">
            <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">
              Customer Details
            </div>
            {[
              ['name',     'Customer / Client Name'],
              ['site',     'Site Name'],
              ['location', 'Location'],
              ['contact',  'Contact Number'],
              ['dealer',   'Dealer Name'],
            ].map(([f, pl], i) => (
              <input
                key={f}
                value={customer[f]}
                onChange={(e) => setCustomer({ ...customer, [f]: e.target.value })}
                placeholder={pl}
                className={
                  'w-full border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500' +
                  (i < 4 ? ' mb-2' : '')
                }
              />
            ))}
          </div>

          {/* Default Rates */}
          <div className="bg-white rounded-lg shadow-sm border border-stone-100">
            <button
              onClick={() => setShowDefaults(!showDefaults)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-stone-600 text-left"
            >
              <span>
                Default rates — GST {defaults.gst}% · Rebate ₹{defaults.rebatePerU}/L ·
                Margin {defaults.margin}% · Disc {defaults.discount}%
              </span>
              {showDefaults ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showDefaults && (
              <div className="px-3 pb-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['gst',        'GST %'],
                    ['rebatePerU', 'Rebate ₹ per L/Kg'],
                    ['margin',     'Dealer Margin %'],
                    ['discount',   'Discount %'],
                  ].map(([f, label]) => (
                    <label key={f} className="text-xs text-stone-500">
                      {label}
                      <input
                        type="number"
                        inputMode="decimal"
                        value={defaults[f]}
                        onChange={(e) => saveDefaults({ ...defaults, [f]: e.target.value })}
                        className="w-full border border-stone-200 rounded px-2 py-1 mt-1 text-sm"
                      />
                    </label>
                  ))}
                </div>
                <div className="text-xs text-stone-400 bg-stone-50 rounded p-2 leading-relaxed">
                  <span className="font-medium text-stone-600">Formula:</span><br />
                  1. Base = DPL − (Rebate/L × Pack Size)<br />
                  2. After GST = Base × (1 + GST%)<br />
                  3. After Margin = After GST × (1 + Margin%)<br />
                  4. Final = After Margin × (1 − Discount%)<br />
                  <span className="text-stone-500">e.g. 1000−40×8+18%+7%−5% = 815.64 ✓</span>
                </div>
              </div>
            )}
          </div>

          {items.length === 0 && (
            <div className="text-center text-stone-400 text-sm py-10 bg-white rounded-lg border border-dashed border-stone-200">
              No products added yet.<br />Tap "Add Product" below to start.
            </div>
          )}

          {/* Item Cards */}
          {items.map((item) => {
            const c      = calc(item);
            const isOpen = expanded === item.id;
            const colors = COLORS[getCat(item.category).color];
            const stock  = STOCK_OPTIONS.find((s) => s.id === item.stockStatus) || STOCK_OPTIONS[0];

            return (
              <div key={item.id} className={'bg-white rounded-lg shadow-sm p-3 border-l-4 ' + colors.border}>
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{item.name}</div>
                    <div className="text-xs text-stone-400">
                      SKU {item.sku} · {getCat(item.category).label}
                      {item.packSize ? ' · ' + item.packSize : ''}
                    </div>
                  </div>
                  <button onClick={() => rem(item.id)} className="text-stone-300 hover:text-red-500 shrink-0">
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <label className="text-xs text-stone-500">
                    Quantity ({item.unit})
                    <input
                      type="number"
                      inputMode="decimal"
                      value={item.quantity}
                      onChange={(e) => upd(item.id, 'quantity', e.target.value)}
                      className="w-full border border-stone-200 rounded px-2 py-1 mt-1 text-sm"
                    />
                  </label>
                  <label className="text-xs text-stone-500">
                    DPL price (₹ per pack)
                    <input
                      type="number"
                      inputMode="decimal"
                      value={item.dpl}
                      onChange={(e) => upd(item.id, 'dpl', e.target.value)}
                      placeholder="from portal"
                      className="w-full border border-stone-200 rounded px-2 py-1 mt-1 text-sm"
                    />
                  </label>
                </div>

                <select
                  value={item.stockStatus}
                  onChange={(e) => upd(item.id, 'stockStatus', e.target.value)}
                  className={'w-full mt-2 rounded px-2 py-1 text-xs border-0 ' + stock.cls}
                >
                  {STOCK_OPTIONS.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>

                <button
                  onClick={() => setExpanded(isOpen ? null : item.id)}
                  className="text-xs text-emerald-700 mt-2 flex items-center gap-1"
                >
                  {isOpen ? 'Hide breakdown' : 'Adjust Rebate / Pack Size / GST / Margin / Discount'}
                  {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                {isOpen && (
                  <div className="mt-2 bg-stone-50 p-2 rounded space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-stone-500">
                        Rebate ₹ per L/Kg
                        <input
                          type="number"
                          inputMode="decimal"
                          value={item.rebatePerU}
                          onChange={(e) => upd(item.id, 'rebatePerU', e.target.value)}
                          className="w-full border border-stone-200 rounded px-2 py-1 mt-1 text-sm"
                        />
                      </label>
                      <label className="text-xs text-stone-500">
                        Pack Size (L or Kg)
                        <input
                          type="number"
                          inputMode="decimal"
                          value={item.packSizeNum}
                          onChange={(e) => upd(item.id, 'packSizeNum', e.target.value)}
                          placeholder="e.g. 8"
                          className="w-full border border-stone-200 rounded px-2 py-1 mt-1 text-sm"
                        />
                      </label>
                      <label className="text-xs text-stone-500">
                        GST %
                        <input
                          type="number"
                          inputMode="decimal"
                          value={item.gst}
                          onChange={(e) => upd(item.id, 'gst', e.target.value)}
                          className="w-full border border-stone-200 rounded px-2 py-1 mt-1 text-sm"
                        />
                      </label>
                      <label className="text-xs text-stone-500">
                        Dealer Margin %
                        <input
                          type="number"
                          inputMode="decimal"
                          value={item.margin}
                          onChange={(e) => upd(item.id, 'margin', e.target.value)}
                          className="w-full border border-stone-200 rounded px-2 py-1 mt-1 text-sm"
                        />
                      </label>
                      <label className="text-xs text-stone-500 col-span-2">
                        Discount %
                        <input
                          type="number"
                          inputMode="decimal"
                          value={item.discount}
                          onChange={(e) => upd(item.id, 'discount', e.target.value)}
                          className="w-full border border-stone-200 rounded px-2 py-1 mt-1 text-sm"
                        />
                      </label>
                    </div>

                    {/* Step-by-step breakdown */}
                    <div className="text-xs border-t border-stone-200 pt-2 space-y-1">
                      <div className="flex justify-between text-stone-500">
                        <span>Rebate deduction ({item.rebatePerU || 0} × {item.packSizeNum || 1})</span>
                        <span className="text-red-500">−₹{fmt(c.rebateDeduction)}</span>
                      </div>
                      <div className="flex justify-between text-stone-500">
                        <span>Base (DPL − Rebate)</span>
                        <span>₹{fmt(c.base)}</span>
                      </div>
                      <div className="flex justify-between text-stone-500">
                        <span>After GST ({item.gst}%)</span>
                        <span>₹{fmt(c.afterGST)}</span>
                      </div>
                      <div className="flex justify-between text-stone-500">
                        <span>After Margin ({item.margin}%)</span>
                        <span>₹{fmt(c.afterMargin)}</span>
                      </div>
                      <div className="flex justify-between text-stone-600 border-t border-stone-200 pt-1">
                        <span>Final per pack/drum</span>
                        <span>₹{fmt(c.finalPerPack)}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-stone-800">
                        <span>Rate per {item.unit === 'Bag' ? 'Bag' : 'Litre/Kg'} (after Disc {item.discount}%)</span>
                        <span>₹{fmt(c.displayRate)}</span>
                      </div>
                      {c.ratePerSqft > 0 && (
                        <div className="flex justify-between font-semibold text-emerald-700 bg-emerald-50 rounded px-1 py-0.5">
                          <span>Rate / Sqft (coverage {item.coverage || item.coverageNum} sqft)</span>
                          <span>₹{fmt(c.ratePerSqft)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center mt-2 pt-2 border-t border-stone-100">
                  <div className="text-xs text-stone-500">
                    Rate: <span className="font-semibold text-stone-800">₹{fmt(c.displayRate)}</span> / {item.unit}
                    {c.ratePerSqft > 0 && (
                      <span className="ml-2 text-emerald-700 font-semibold">· ₹{fmt(c.ratePerSqft)}/sqft</span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-emerald-700">₹{fmt(c.lineTotal)}</div>
                </div>
                {(item.coverage || item.warranty) && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {item.coverage && (
                      <span className="text-xs bg-blue-50 text-blue-700 rounded px-2 py-0.5">
                        Coverage: {item.coverage} sqft/{item.unit === 'Bag' ? 'Kg' : 'Ltr'}
                      </span>
                    )}
                    {item.warranty && (
                      <span className="text-xs bg-purple-50 text-purple-700 rounded px-2 py-0.5">
                        Warranty: {item.warranty}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <button
            onClick={() => setShowPicker(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-3 text-sm font-medium flex items-center justify-center gap-2 shadow-sm"
          >
            <Plus size={18} /> Add Product
          </button>

          {items.length > 0 && (
            <>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex justify-between items-center">
                <span className="font-medium text-emerald-900 text-sm">Grand Total</span>
                <span className="text-lg font-bold text-emerald-900">₹{fmt(grandTotal)}</span>
              </div>

              {/* Summary */}
              <div className="bg-white rounded-lg shadow-sm p-3 border border-stone-100 space-y-3">
                <div className="font-medium text-sm flex items-center gap-1 text-stone-700">
                  <FileText size={14} /> Summary
                </div>
                {Object.entries(grouped).map(([catId, catItems]) => {
                  const cat      = getCat(catId);
                  const totalQty = catItems.reduce((s, it) => s + (parseFloat(it.quantity) || 0), 0);
                  const totalAmt = catItems.reduce((s, it) => s + calc(it).lineTotal, 0);
                  return (
                    <div key={catId} className="text-xs">
                      <div className="font-medium text-stone-700 flex items-center gap-1.5">
                        <span className={'inline-block w-2 h-2 rounded-full ' + COLORS[cat.color].dot} />
                        {cat.label}
                      </div>
                      <div className="pl-3.5 mt-1 space-y-0.5">
                        {catItems.map((it) => (
                          <div key={it.id} className="flex justify-between text-stone-500">
                            <span className="truncate pr-2">
                              {it.name} — {it.quantity} {plural(it.unit, it.quantity)} × ₹{fmt(calc(it).displayRate)}
                            </span>
                            <span className="shrink-0">₹{fmt(calc(it).lineTotal)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between font-medium text-stone-700 pl-3.5 mt-1 pt-1 border-t border-stone-100">
                        <span>Total {plural(cat.unit, totalQty)} Required: {totalQty} {plural(cat.unit, totalQty)}</span>
                        <span>₹{fmt(totalAmt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => openPreview()}
                className="w-full bg-stone-800 hover:bg-stone-900 text-white rounded-lg py-3 text-sm font-medium flex items-center justify-center gap-2 shadow-sm"
              >
                <Printer size={18} /> Preview &amp; Print Quotation
              </button>

              <button
                onClick={() => { setItems([]); setCustomer(BLANK_CUSTOMER); }}
                className="w-full text-stone-400 text-xs py-2"
              >
                Clear quotation and start new
              </button>
            </>
          )}
        </div>
      )}

      {/* ── CATALOG TAB ── */}
      {tab === 'catalog' && (
        <div className="p-3 space-y-3">
          <button
            onClick={() => showAddProd ? cancelEdit() : setShowAddProd(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-3 text-sm font-medium flex items-center justify-center gap-2 shadow-sm"
          >
            {showAddProd ? <><X size={18} /> Close</> : <><Plus size={18} /> Add product to catalog</>}
          </button>

          {showAddProd && (
            <div className="bg-white rounded-lg shadow-sm p-3 space-y-2 border border-stone-100">
              {newProd.id && (
                <div className="text-xs font-medium text-emerald-700">Editing product</div>
              )}
              <input
                value={newProd.name}
                onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
                placeholder="Product name (e.g. HS Waterproof Putty)"
                className="w-full border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                value={newProd.sku}
                onChange={(e) => setNewProd({ ...newProd, sku: e.target.value })}
                placeholder="SKU code"
                className="w-full border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <select
                value={newProd.category}
                onChange={(e) => setNewProd({ ...newProd, category: e.target.value })}
                className="w-full border border-stone-200 rounded px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={newProd.packSize}
                  onChange={(e) => setNewProd({ ...newProd, packSize: e.target.value })}
                  placeholder="Pack size label (e.g. 8 Ltrs)"
                  className="border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  value={newProd.packSizeNum}
                  onChange={(e) => setNewProd({ ...newProd, packSizeNum: e.target.value })}
                  placeholder="Pack size number (8)"
                  className="border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  value={newProd.dplRate}
                  onChange={(e) => setNewProd({ ...newProd, dplRate: e.target.value })}
                  placeholder="DPL rate (₹)"
                  className="border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 col-span-2"
                />
                <input
                  value={newProd.coverage}
                  onChange={(e) => setNewProd({ ...newProd, coverage: e.target.value })}
                  placeholder="Coverage range (e.g. 10-14)"
                  className="border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  value={newProd.coverageNum}
                  onChange={(e) => setNewProd({ ...newProd, coverageNum: e.target.value })}
                  placeholder="Coverage for calc (e.g. 10)"
                  className="border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  value={newProd.warranty}
                  onChange={(e) => setNewProd({ ...newProd, warranty: e.target.value })}
                  placeholder="Warranty (e.g. 5 to 7 Years)"
                  className="border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  value={newProd.colour}
                  onChange={(e) => setNewProd({ ...newProd, colour: e.target.value })}
                  placeholder="Colour (e.g. White)"
                  className="border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <p className="text-xs text-stone-400">
                Pack size number lets the app auto-calculate rebate deduction (Rebate/L × Pack size).
                Update DPL rate here whenever Berger issues a new price circular.
              </p>
              <div className="flex gap-2">
                <button onClick={saveProd} className="flex-1 bg-emerald-600 text-white rounded py-2 text-sm font-medium">
                  {newProd.id ? 'Update product' : 'Save product'}
                </button>
                {newProd.id && (
                  <button onClick={cancelEdit} className="px-4 bg-stone-100 text-stone-600 rounded py-2 text-sm">
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}

          {catalog.length === 0 && (
            <div className="text-center text-stone-400 text-sm py-10 bg-white rounded-lg border border-dashed border-stone-200">
              No products saved yet.<br />
              Add your ~35 common SKUs once — reuse in every quotation.
            </div>
          )}

          {CATEGORIES.map((cat) => {
            const prods = catalog.filter((p) => p.category === cat.id);
            if (!prods.length) return null;
            return (
              <div key={cat.id}>
                <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide mt-2 mb-1 flex items-center gap-1.5">
                  <span className={'inline-block w-2 h-2 rounded-full ' + COLORS[cat.color].dot} />
                  {cat.label}
                </div>
                {prods.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => editProd(p)}
                    className={'bg-white rounded-lg shadow-sm p-3 flex justify-between items-center mb-2 border-l-4 cursor-pointer ' + COLORS[cat.color].border}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-xs text-stone-400">
                        SKU: {p.sku}
                        {p.packSize    ? ' · ' + p.packSize                  : ''}
                        {p.dplRate     ? ' · DPL ₹' + p.dplRate : ' · DPL not set'}
                        {p.coverage    ? ' · Cov: ' + p.coverage + ' sqft'  : ''}
                        {p.warranty    ? ' · ' + p.warranty                  : ''}
                      </div>
                    </div>
                    <button onClick={(e) => delProd(p.id, e)} className="text-stone-300 hover:text-red-500 shrink-0 ml-2">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ── PRODUCT PICKER ── */}
      {showPicker && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 flex items-end z-20"
          onClick={() => setShowPicker(false)}
        >
          <div
            className="bg-white rounded-t-2xl w-full max-h-[70vh] overflow-y-auto p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-stone-800">Select product</h3>
              <button onClick={() => setShowPicker(false)} className="text-stone-400">
                <X size={20} />
              </button>
            </div>
            {catalog.length === 0 && (
              <div className="text-sm text-stone-400 py-4 text-center">
                No products yet. Go to Catalog tab to add SKUs.
              </div>
            )}
            {CATEGORIES.map((cat) => {
              const prods = catalog.filter((p) => p.category === cat.id);
              if (!prods.length) return null;
              return (
                <div key={cat.id} className="mb-3">
                  <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                    <span className={'inline-block w-2 h-2 rounded-full ' + COLORS[cat.color].dot} />
                    {cat.label}
                  </div>
                  {prods.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addItem(p)}
                      className="w-full text-left bg-stone-50 hover:bg-emerald-50 active:bg-emerald-100 rounded px-3 py-2 mb-1 text-sm flex justify-between items-center"
                    >
                      <span>
                        {p.name} <span className="text-stone-400 text-xs">({p.sku})</span>
                      </span>
                      {p.dplRate
                        ? <span className="text-xs text-stone-400 shrink-0 ml-2">₹{p.dplRate}</span>
                        : null}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
