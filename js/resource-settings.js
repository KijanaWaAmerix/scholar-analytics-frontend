/* Learning resources: chosen automatically for each lesson, or typed by the teacher once for each strand.
   What a teacher types for a strand goes into every sub-strand and lesson of it (scheme and lesson plans).
   It is kept in this browser, for this teacher, per curriculum design. */
const ResourceSettings = (() => {
  const who = () => {
    try { const u = JSON.parse(localStorage.getItem('sa_user')); return u?._id || u?.id || u?.email || 'user'; } catch { return 'user'; }
  };
  const KEY = () => `sa_resources_${who()}`;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY())) || {}; } catch { return {}; } };
  const save = (all) => { try { localStorage.setItem(KEY(), JSON.stringify(all)); } catch { /* private window: skip */ } };
  const clean = (list) => (Array.isArray(list) ? list : [])
    .map((x) => String(x).replace(/^[\s•\-*\d.)]+/, '').trim()).filter(Boolean);

  /* "Charts, markers; Bible" or one per line -> ['Charts', 'markers', 'Bible'] */
  const parse = (text) => clean(String(text || '').split(/[\n;,]+/));

  return {
    parse,
    isManual: (designKey) => !!load()[designKey]?.manual,
    setManual: (designKey, on) => { const a = load(); a[designKey] = { ...(a[designKey] || {}), manual: !!on }; save(a); },
    getText: (designKey, strandId) => load()[designKey]?.strands?.[strandId] || '',
    setText: (designKey, strandId, text) => {
      const a = load(); const d = a[designKey] || {};
      d.strands = { ...(d.strands || {}), [strandId]: String(text || '') };
      a[designKey] = d; save(a);
    },
    /* the typed list for a strand, or null when the lesson should use the automatic resources */
    override: (designKey, strandId) => {
      const d = load()[designKey];
      if (!d || !d.manual) return null;
      const list = parse(d.strands?.[strandId]);
      return list.length ? list : null;
    },
  };
})();
