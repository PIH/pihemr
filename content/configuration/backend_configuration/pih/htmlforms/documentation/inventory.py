#!/usr/bin/env python3
"""Inventory + mechanical Verify-A checks for HFE forms.

For each current form (versioned *_v1.0 / *_Version3 copies are skipped unless named with --include) writes <out>/<form>.inv.md with:
  header facts, includes, macros, mechanical Verify-A findings (leads, not verdicts),
  a conditional-display table and a JavaScript table (the input for the form's e2e spec: its conditions and scripts),
  `triviality` (whether the form itself has no conditions/scripts/findings).
Forms flagged trivial have nothing conditional or scripted of their own (a save test is enough). With --only-changed,
forms whose XML is unchanged since their e2e spec was written (per git) are skipped.

Needs lxml (pip install lxml; e.g. in a venv). Run with the venv python.

This file lives in pihemr and is run against a site config repo (zl-emr, pihsl-emr, pihliberia-emr):
  python3 -I <pihemr>/content/configuration/backend_configuration/pih/htmlforms/documentation/inventory.py \
      --site-repo <site repo> --out /tmp/inv [--only-changed]
  ... --site-repo <site repo> --forms-dir <pihemr>/content/configuration/backend_configuration/pih/htmlforms --out /tmp/inv-inherited
  ... --site-repo <site repo> --check-coverage          # no --out needed; exit code 1 when a form is unaccounted for
Without --site-repo the repo this file sits in is the site (the old behaviour).

--check-coverage: every form of the merged htmlforms directory (site forms shadowing pihemr's; versioned *_v1.0 /
*_Version3 / *_old copies and retired/ directories excluded) must have a spec (e2e/specs/<form>/<form>.spec.ts), or be
named in a "Not reachable" or "Not covered" section of <site>/.../documentation/_availability.e2e.md. It also lists specs
whose form no longer exists. Run it before declaring a spec run done, and in CI.
"""
import argparse, csv, glob, json, os, re, sys, copy
from collections import defaultdict, Counter
from lxml import etree

HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument('--forms-dir', default=None, help='htmlforms directory; default: the site repo\'s own')
ap.add_argument('--merged-dir', default=None, help='merged config dir containing subforms/ (parent + site); default: search distro/target/**/openmrs_config/pih')
ap.add_argument('--concepts', default=None, help='concept mappings CSV (name,concept_id,source,code); default: newest "full concept mappings*.csv" in documentation/')
ap.add_argument('--out', default=None, help='output directory for the <form>.inv.md files (required unless --check-coverage)')
ap.add_argument('--site-repo', default=None, help='site config repo (zl-emr, pihsl-emr, pihliberia-emr); default: the repo this file sits in')
ap.add_argument('--check-coverage', action='store_true', help='check that every form of the merged directory has a spec or is listed in _availability.e2e.md as not reachable / not covered; exit 1 if not')
ap.add_argument('--specs-dir', default=None, help='e2e specs directory (specs/<form>/<form>.spec.ts); default: <site repo>/e2e/specs')
ap.add_argument('--only-changed', action='store_true', help='skip forms whose XML is unchanged since their e2e spec was last committed (git; uncommitted spec: XML not newer than it)')
ap.add_argument('--availability-file', default=None, help='default: <site repo>/.../htmlforms/documentation/_availability.e2e.md')
ap.add_argument('--include', action='append', default=[], help='versioned form to inventory anyway (e.g. checkin_v3.5.xml); repeatable')
ARGS = ap.parse_args()
if not ARGS.out and not ARGS.check_coverage:
    ap.error('--out is required (unless --check-coverage)')

SITE = os.path.abspath(ARGS.site_repo) if ARGS.site_repo else os.path.abspath(os.path.join(HERE, *(['..'] * 6)))
SITE_PIH = os.path.join(SITE, 'content', 'configuration', 'backend_configuration', 'pih')
SITE_DOC = os.path.join(SITE_PIH, 'htmlforms', 'documentation')
if ARGS.forms_dir is None:
    ARGS.forms_dir = os.path.join(SITE_PIH, 'htmlforms')
if ARGS.specs_dir is None:
    ARGS.specs_dir = os.path.join(SITE, 'e2e', 'specs')
if ARGS.availability_file is None:
    ARGS.availability_file = os.path.join(SITE_DOC, '_availability.e2e.md')

FORMS = ARGS.forms_dir
REPO = os.path.dirname(FORMS)  # .../pih
if ARGS.merged_dir:
    MERGED = ARGS.merged_dir
else:
    cands = glob.glob(os.path.join(SITE, 'distro', 'target', '*', 'web', 'openmrs_config', 'pih'))
    MERGED = os.path.abspath(cands[0]) if cands else REPO
if ARGS.concepts:
    CSV_MAP = ARGS.concepts
else:
    found = sorted(glob.glob(os.path.join(SITE_DOC, 'full concept mappings*.csv')) + glob.glob(os.path.join(SITE_DOC, 'full_concept_mappings*.csv'))) \
        or sorted(glob.glob(os.path.join(HERE, 'full concept mappings*.csv')) + glob.glob(os.path.join(HERE, 'full_concept_mappings*.csv')))
    CSV_MAP = found[-1] if found else None
OUT = ARGS.out
if OUT:
    os.makedirs(OUT, exist_ok=True)

# shared subforms whose conditions/JS are documented once in _shared.e2e.md (not counted against a form)
SHARED_PREFIXES = ('subforms/',)

# ---- concept mappings
CONCEPTS = {}
if CSV_MAP:
    with open(CSV_MAP, newline='', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            CONCEPTS[(r['source'] + ':' + r['code']).upper()] = r['name']
else:
    print('WARNING: no concept mappings CSV; concept-unresolved check disabled', file=sys.stderr)
UNRESOLVED = {}  # concept -> True if every use is in a file committed after the CSV date (CSV likely stale)


def csv_date():
    import datetime
    m = re.search(r'(\d{1,2}-[A-Za-z]{3}-\d{4})', os.path.basename(CSV_MAP or ''))
    try:
        return datetime.datetime.strptime(m.group(1), '%d-%b-%Y').date().isoformat() if m else None
    except ValueError:
        return None


_commit_dates = {}


def committed_after_csv(path):
    cd = csv_date()
    if not cd:
        return False
    if path not in _commit_dates:
        import subprocess
        r = subprocess.run(['git', '-C', os.path.dirname(path), 'log', '-1', '--format=%cs', '--', path], capture_output=True, text=True)
        _commit_dates[path] = r.stdout.strip()
    return bool(_commit_dates[path]) and _commit_dates[path] > cd


def note_unresolved(c, path):
    after = committed_after_csv(path)
    UNRESOLVED[c] = UNRESOLVED.get(c, True) and after
    return ' (file last committed after the CSV date: CSV likely stale)' if after else ' (file not changed since the CSV: check the concept)'


UUID_RE = re.compile(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')


def resolve_path(p):
    """subform path attr -> file on disk"""
    p = p.strip()
    p = re.sub(r'^configuration/pih/', '', p)
    for base in (REPO, MERGED):
        fp = os.path.join(base, p)
        if os.path.exists(fp):
            return fp
    return None


def load(fp):
    parser = etree.XMLParser(remove_comments=False, resolve_entities=False)
    raw = open(fp, encoding='utf-8').read()
    # HTML entities HFE tolerates but XML does not define
    raw = raw.replace('&nbsp;', '&#160;').replace('&copy;', '&#169;')
    raw = re.sub(r'^\s*<\?xml[^>]*\?>', '', raw)
    try:
        return etree.fromstring(raw.encode('utf-8'), parser)
    except Exception as e:
        # some shared subforms are fragments with several top-level nodes: retry inside a wrapper element
        try:
            return etree.fromstring(('<wrapper>' + raw + '</wrapper>').encode('utf-8'), parser)
        except Exception:
            return e


def tag(e):
    return e.tag if isinstance(e.tag, str) else None


def split_list(s):
    return [x.strip() for x in s.split(',')] if s is not None else []


def macros_of(root):
    out = {}
    for m in root.iter('macros'):
        for line in (m.text or '').splitlines():
            line = line.strip()
            if '=' in line:
                k, v = line.split('=', 1)
                out[k.strip()] = v.strip()
    for m in root.iter('macro'):
        if m.get('key'):
            out[m.get('key')] = m.get('value')
    return out


def expand_repeats(root):
    """Return list of (element, line) for the 'rendered' view: repeat/template expanded.
    We expand in a deep copy so ids with {var} get resolved."""
    root = copy.deepcopy(root)

    def subst(el, vals):
        for k in list(el.attrib):
            v = el.attrib[k]
            for kk, vv in vals.items():
                v = v.replace('{' + kk + '}', vv)
            el.set(k, v)
        if el.text:
            for kk, vv in vals.items():
                el.text = el.text.replace('{' + kk + '}', vv)
        if el.tail:
            for kk, vv in vals.items():
                el.tail = el.tail.replace('{' + kk + '}', vv)
        for c in el:
            subst(c, vals)

    changed = True
    while changed:
        changed = False
        for rep in list(root.iter('repeat')):
            parent = rep.getparent()
            if parent is None:
                continue
            tmpl = rep.find('template')
            renders = rep.findall('render')
            new = []
            if tmpl is not None:
                for r in renders:
                    vals = dict(r.attrib)
                    for c in tmpl:
                        cc = copy.deepcopy(c)
                        subst(cc, vals)
                        new.append(cc)
            elif rep.get('with') is not None:
                # with="['a','b'],['c','d']" ; {0},{1}..
                w = rep.get('with')
                rows = re.findall(r'\[([^\]]*)\]', w) or [w]
                if '[' not in w:
                    rows = [x.strip() for x in w.split(',')]
                for row in rows:
                    cells = [x.strip().strip("'\"") for x in re.split(r",(?=(?:[^']*'[^']*')*[^']*$)", row)]
                    vals = {str(i): c for i, c in enumerate(cells)}
                    for c in rep:
                        cc = copy.deepcopy(c)
                        subst(cc, vals)
                        new.append(cc)
            idx = parent.index(rep)
            parent.remove(rep)
            for n in reversed(new):
                parent.insert(idx, n)
            changed = True
    return root


class FormInfo:
    pass


def inventory_file(fp, seen):
    """Return dict for a single file."""
    root = load(fp)
    info = {'file': os.path.relpath(fp, os.path.dirname(REPO)) if fp.startswith(REPO) else fp, 'errors': []}
    if isinstance(root, Exception):
        info['errors'].append('XML parse error: %s' % root)
        return info, None
    info['root'] = dict(root.attrib) if tag(root) == 'htmlform' else {}
    mac = macros_of(root)
    info['macros'] = mac
    info['macro_uses'] = sorted(set(re.findall(r'\$([A-Za-z_][\w.]*)', etree.tostring(root, encoding='unicode'))))
    return info, root


def line(e):
    return e.sourceline


def main():
    # forms in subdirectories (e.g. hiv/) are included with their relative path; the output is flat, by base name
    forms = sorted(os.path.relpath(os.path.join(d, f), FORMS)
                   for d, subdirs, files in os.walk(FORMS) if os.path.basename(d) != 'documentation'
                   for f in files if f.endswith('.xml') and (f in ARGS.include or not re.search(r'_v\d|_Version\d', f)))
    summary = {}
    allroots = {}
    for f in forms:
        fp = os.path.join(FORMS, f)
        info, root = inventory_file(fp, set())
        allroots[f] = (fp, info, root)
    for f in forms:
        fp, info, root = allroots[f]
        if ARGS.only_changed:
            if e2e_up_to_date(fp, os.path.join(ARGS.specs_dir, os.path.basename(f)[:-4], os.path.basename(f)[:-4] + '.spec.ts')):
                continue
        L = []
        w = L.append
        w('# Inventory: %s' % f)
        if root is None:
            w('PARSE ERROR: %s' % info['errors'])
            open(os.path.join(OUT, os.path.basename(f).replace('.xml', '.inv.md')), 'w').write('\n'.join(L))
            continue
        r = info['root']
        w('formUuid=%s' % r.get('formUuid'))
        w('formName=%s' % r.get('formName'))
        w('formEncounterType=%s' % r.get('formEncounterType'))
        w('formVersion=%s' % r.get('formVersion'))
        w('lines=%d' % sum(1 for _ in open(fp)))
        # collect files: self + transitive subforms
        files = [(f, fp, root)]
        queue = [(f, fp, root)]
        seenf = {fp}
        includes = []
        missing_sub = []
        while queue:
            nm, p, rt = queue.pop()
            for sf in rt.iter('subform'):
                path = sf.get('path')
                if not path:
                    missing_sub.append((nm, line(sf), 'no path'))
                    continue
                tp = resolve_path(path)
                includes.append((nm, line(sf), path, tp is not None))
                if tp is not None and not tp.endswith('.xml'):
                    continue
                if tp is None:
                    missing_sub.append((nm, line(sf), path))
                    continue
                if tp in seenf:
                    continue
                seenf.add(tp)
                i2, r2 = inventory_file(tp, seenf)
                if r2 is None:
                    missing_sub.append((nm, line(sf), 'parse error ' + path))
                    continue
                ent = (os.path.relpath(tp, MERGED if tp.startswith(MERGED) else REPO), tp, r2)
                files.append(ent)
                queue.append(ent)
        w('\n## Includes (subform path; resolved?) -> `[section]` (section-*) or `[sub-form]` (everything else)')
        for nm, ln, path, ok in includes:
            w('- [%s] %s:%s -> %s %s' % ('section' if os.path.basename(path).startswith('section-') else 'sub-form', nm, ln, path, 'OK' if ok else 'MISSING'))
        # script includes
        for nm, p, rt in files:
            for s in rt.iter('script'):
                if s.get('src'):
                    w('- %s:%s <script src=%s>' % (nm, line(s), s.get('src')))
        # macros
        w('\n## Macros defined (file: name=value)')
        defs = defaultdict(list)
        for nm, p, rt in files:
            for k, v in macros_of(rt).items():
                defs[k].append((nm, v))
        for k, lst in defs.items():
            vals = {v for _, v in lst}
            w('- $%s = %s  [%s]%s' % (k, lst[0][1], ', '.join(n for n, _ in lst), '  **CLASH: ' + ' | '.join(sorted(vals)) + '**' if len(vals) > 1 else ''))
        w('\n## Verify-A mechanical findings')
        F = []

        def fin(nm, ln, kind, msg):
            F.append((nm, ln, kind, msg))

        for nm, p, rt in files:
            text = open(p, encoding='utf-8').read()
            lines_ = text.splitlines()
            rend = expand_repeats(rt)
            macs = {}
            for _n, _p, _r in files:
                macs.update(macros_of(_r))
                # velocity variables assigned in lookups / #set directives count as defined
                for _v in re.findall(r'#set\(\s*\$!?\{?(\w+)', etree.tostring(_r, encoding='unicode')):
                    macs[_v] = '(#set)'
            # macro use vs def (macro uses are $name inside attrs; filter out velocity in scripts)
            for e in rend.iter():
                if tag(e) is None:
                    continue
                for k, v in e.attrib.items():
                    for mu in re.findall(r'\$\{?([A-Za-z_][\w]*)', v):
                        if mu not in macs and mu not in ('encounter', 'patient', 'visit', 'fn', 'form', 'session', 'context', 'formGeneratedDatetime', 'patientIdentifiers', 'personAttributes', 'relationshipList', 'relationshipMap', 'providerGroup', 'locale', 'user', 'config', 'JSON', 'jq'):
                            # velocity vars set via lookup/set not tracked: report as info
                            fin(nm, line(e), 'macro-undefined?', '$%s used in <%s %s=...> but not in <macros>' % (mu, e.tag, k))
            # obs-level checks
            for e in rend.iter('obs'):
                at = e.attrib
                ids = at.get('answerConceptIds')
                lbls = at.get('answerLabels')
                codes = at.get('answerCodes')
                if ids is not None:
                    n = len(split_list(ids))
                    if lbls is not None and len(split_list(lbls)) != n:
                        fin(nm, line(e), 'answer-count', 'answerConceptIds(%d) vs answerLabels(%d): %s | %s' % (n, len(split_list(lbls)), ids, lbls))
                    if codes is not None and len(split_list(codes)) != n:
                        fin(nm, line(e), 'answer-count', 'answerConceptIds(%d) vs answerCodes(%d)' % (n, len(split_list(codes))))
                    if at.get('answerLabel') is not None:
                        fin(nm, line(e), 'singular-label', 'answerLabel= ignored with answerConceptIds=')
                if at.get('answerConceptId') is not None and ',' in at.get('answerConceptId'):
                    fin(nm, line(e), 'singular-list', 'answerConceptId contains a list: %s' % at.get('answerConceptId'))
                if at.get('answerLabels') is not None and at.get('answerConceptId') is not None and ids is None:
                    fin(nm, line(e), 'plural-label-singular-id', 'answerLabels= with answerConceptId= (should be answerLabel=)')
                for a in ('required', 'allowFutureDates', 'allowPastDates', 'showTime'):
                    if a in at and at[a] not in ('true', 'false'):
                        fin(nm, line(e), 'bool-attr', '%s="%s"' % (a, at[a]))
                st = at.get('style')
                for a in ('conceptId', 'conceptIds'):
                    v = at.get(a)
                    if v is None:
                        continue
                    for c in split_list(v):
                        if re.fullmatch(r'\d+', c):
                            fin(nm, line(e), 'hardcoded-id', '%s="%s" bare numeric id' % (a, v))
                # answers in <when>
                ctl = e.find('controls')
                if ctl is not None and ids is not None:
                    ans = {x.upper() for x in split_list(ids)}
                    for wh in ctl.findall('when'):
                        v = (wh.get('value') or '').strip()
                        if v.upper() not in ans and v not in ('true', 'false') and not v.startswith('$'):
                            fin(nm, line(wh), 'when-not-in-answers', '<when value="%s"> not in answerConceptIds=%s' % (v, ids))
                # concept resolution
                for a in ('conceptId', 'conceptIds', 'answerConceptId', 'answerConceptIds'):
                    v = at.get(a)
                    if v is None:
                        continue
                    for c in split_list(v):
                        if c.startswith('$') or UUID_RE.match(c) or re.fullmatch(r'\d+', c):
                            continue
                        if ':' in c and CONCEPTS:
                            if c.upper() not in CONCEPTS:
                                fin(nm, line(e), 'concept-unresolved', '%s %s not in mappings CSV%s' % (a, c, note_unresolved(c.upper(), p)))
            for e in rend.iter('obsgroup'):
                v = e.get('groupingConceptId')
                if CONCEPTS and v and not (v.startswith('$') or UUID_RE.match(v)) and ':' in v and v.upper() not in CONCEPTS:
                    fin(nm, line(e), 'concept-unresolved', 'groupingConceptId %s not in mappings CSV%s' % (v, note_unresolved(v.upper(), p)))
                if v and re.fullmatch(r'\d+', v):
                    fin(nm, line(e), 'hardcoded-id', 'groupingConceptId="%s"' % v)
            # hardcoded keys via regex over raw text
            for i, ln in enumerate(lines_, 1):
                if re.search(r'fn\.\w+\(\s*\d+\s*[,)]', ln):
                    fin(nm, i, 'hardcoded-id', ln.strip()[:160])
                if re.search(r'default="\d+"', ln):
                    fin(nm, i, 'hardcoded-id', ln.strip()[:160])
                if re.search(r'\b(?:programId|workflowId|locationId|stateId)="\d+"', ln):
                    fin(nm, i, 'hardcoded-id', ln.strip()[:160])
            # {0}-style placeholders outside repeat in the ORIGINAL tree
            for e in rt.iter():
                if tag(e) is None:
                    continue
                inrep = any(a.tag == 'repeat' for a in e.iterancestors())
                if inrep or e.tag in ('repeat', 'template', 'render', 'script', 'macros', 'style'):
                    continue
                for k, v in e.attrib.items():
                    if re.search(r'\{\w+\}', v):
                        fin(nm, line(e), 'placeholder-outside-repeat', '<%s %s="%s">' % (e.tag, k, v))
            # repeat var coverage
            for rep in rt.iter('repeat'):
                tmpl = rep.find('template')
                if tmpl is None:
                    continue
                used = set(re.findall(r'\{(\w+)\}', etree.tostring(tmpl, encoding='unicode')))
                for rr in rep.findall('render'):
                    miss = used - set(rr.attrib) - {'0'}
                    if miss:
                        fin(nm, line(rr), 'render-missing-var', 'template uses %s; render has %s' % (sorted(miss), sorted(rr.attrib)))
        # id duplicates across rendered union (ids in html elements only, not obs concept ids)
        idmap = defaultdict(list)
        targets = []
        for nm, p, rt in files:
            rend = expand_repeats(rt)
            for e in rend.iter():
                if tag(e) is None:
                    continue
                if e.get('id') and e.tag not in ('render',):
                    idmap[e.get('id')].append((nm, line(e), e.tag))
                if e.tag == 'when' and e.get('thenDisplay'):
                    targets.append((nm, line(e), 'thenDisplay', e.get('thenDisplay')))
                if e.get('toggle'):
                    targets.append((nm, line(e), 'toggle', e.get('toggle')))
        for k, lst in idmap.items():
            if len(lst) > 1:
                ex = '; '.join('%s:%s<%s>' % x for x in lst[:6])
                # ignore when ids originate in same repeated file but legit? still report
                fin('(form)', 0, 'duplicate-id', 'id="%s" x%d: %s' % (k, len(lst), ex))
        classmap = defaultdict(int)
        for nm, p, rt in files:
            for e in expand_repeats(rt).iter():
                if tag(e) and e.get('class'):
                    for c in e.get('class').split():
                        classmap[c] += 1
        for nm, ln, kind, t in targets:
            t = t.strip()
            if kind == 'toggle':
                # HFE ToggleWidget: "id" or "{id: 'x', class: 'y', style: 'dim'}"; htmlForm.js toggles "#target, .target"
                tid = tcls = None
                if t.startswith('{') and t.endswith('}'):
                    for pair in t.strip('{}').split(','):
                        if ':' in pair:
                            k, v = [x.strip().strip('\'"') for x in pair.split(':', 1)]
                            if k.lower() == 'id':
                                tid = v
                            elif k.lower() == 'class':
                                tcls = v
                else:
                    tid = t.strip('\'"')
                # htmlForm.js setupObsToggleHandlers: the checkbox toggles "#target, .target" (id OR class)
                for tgt in [x for x in (tid, tcls) if x]:
                    if len(idmap.get(tgt, [])) + classmap.get(tgt, 0) == 0:
                        fin(nm, ln, 'target-missing', 'toggle target "%s" matches no id or class' % tgt)
                continue
            if t.startswith('#'):
                n = len(idmap.get(t[1:], []))
                if n != 1:
                    fin(nm, ln, 'target-missing' if n == 0 else 'target-ambiguous', '%s="%s" resolves %d times' % (kind, t, n))
            elif t.startswith('.'):
                if classmap.get(t[1:], 0) == 0:
                    fin(nm, ln, 'target-missing', '%s="%s" class not found' % (kind, t))
        if missing_sub:
            for x in missing_sub:
                fin(x[0], x[1], 'subform-missing', str(x[2]))
        # dedupe
        seenF = set()
        for nm, ln, kind, msg in F:
            key = (nm, ln, kind, msg)
            if key in seenF:
                continue
            seenF.add(key)
            w('- [%s] %s:%s %s' % (kind, nm, ln, msg))
        if not F:
            w('- (none)')
        # ---- own vs shared
        def own(nm):
            return nm == f
        cond_rows, cond_shared = [], 0
        for nm, p, rt in files:
            for e in rt.iter():
                t = tag(e)
                if t is None:
                    continue
                rows = []
                if t == 'when':
                    obs = e.getparent().getparent() if e.getparent() is not None else None
                    oc = obs.get('conceptId') if obs is not None else None
                    tgt = e.get('thenDisplay') or ('js' if e.get('thenJavaScript') else '?')
                    rows.append('| when | %s:%s | obs %s = %s → show `%s`%s | select the answer, assert target visible; pick another, assert hidden |' % (nm, line(e), oc, e.get('value'), tgt, ' (+JS)' if (e.get('thenJavaScript') or e.get('elseJavaScript')) else ''))
                elif t == 'ifMode':
                    rows.append('| ifMode | %s:%s | mode=%s include=%s: %d obs, %d scripts | open the form in the matching mode |' % (nm, line(e), e.get('mode'), e.get('include', 'true(default)'), len(list(e.iter('obs'))), len(list(e.iter('script')))))
                elif t in ('includeIf', 'excludeIf'):
                    cond = e.get('velocityTest') or e.get('logicTest') or str(dict(e.attrib))
                    rows.append('| %s | %s:%s | `%s` (%d obs) | **fixture needed** |' % (t, nm, line(e), cond.replace('|', '\\|')[:140], len(list(e.iter('obs')))))
                if e.get('toggle'):
                    rows.append('| toggle | %s:%s | `%s` toggles `%s` | check/uncheck, assert target |' % (nm, line(e), e.get('conceptId'), e.get('toggle')))
                for row in rows:
                    if own(nm):
                        cond_rows.append(row)
                    else:
                        cond_shared += 1
        w('\n## Conditional display — rows for the spec (own file only; %d more in shared subforms → `_shared.e2e.md`)' % cond_shared)
        w('| Kind | Where | Trigger → effect | Test fixture / action |\n|---|---|---|---|')
        for row in cond_rows:
            w(row)
        if not cond_rows:
            w('(none)')
        sigs = ['beforeSubmit', 'getBeforeValidation', 'getValueIfLegal', 'enableSubmitButton', 'disableSubmitButton', 'getField(', 'ws/rest', '$.ajax', 'jq.ajax', 'fetch(', '<lookup', '.show()', '.hide()', '.toggle(', 'prop(', '.val(', 'alert(', 'setUpNextAndSubmitButtons', 'jq(document).ready', 'jq(function', '$(function']

        def kind_of(sg):
            if any(x in sg for x in ('beforeSubmit', 'getBeforeValidation', 'disableSubmitButton', 'alert(', 'getValueIfLegal')):
                return 'validation?'
            if any(x in sg for x in ('ws/rest', '$.ajax', 'jq.ajax', 'fetch(', '<lookup')):
                return 'prefill/lookup?'
            if 'setUpNextAndSubmitButtons' in sg and len(sg) <= 3:
                return 'navigation'
            if any(x in sg for x in ('.show()', '.hide()', '.toggle(', 'prop(')):
                return 'show/hide?'
            return 'other'
        js_rows, js_shared = [], 0
        for nm, p, rt in files:
            for sc in rt.iter('script'):
                body = ''.join(sc.itertext())
                full = etree.tostring(sc, encoding='unicode')
                present = [g for g in sigs if g in full]
                first = ''
                for ln_ in body.splitlines():
                    if ln_.strip():
                        first = ln_.strip()[:70].replace('|', '\\|')
                        break
                row = '| %s | %s:%s (%d lines) | signals: %s; starts `%s` — **read and describe: rule, message, formula, default** |' % (kind_of(present), nm, line(sc), body.count('\n') + 1, ', '.join(present) or '-', first)
                if own(nm):
                    js_rows.append(row)
                else:
                    js_shared += 1
        w('\n## JavaScript — rows for the spec (own file only; %d scripts in shared subforms → `_shared.e2e.md`)' % js_shared)
        w('| Kind | Where | What it does |\n|---|---|---|')
        for row in js_rows:
            w(row)
        if not js_rows:
            w('(none)')
        w('\n## Widgets / specials counts (own file)')
        cnt = Counter()
        for e in root.iter():
            t = tag(e)
            if t in ('encounterDiagnosesByObs', 'encounterDisposition', 'scheduleAppointment', 'enrollInProgram', 'pihLabOrder', 'drugOrder', 'postSubmissionAction', 'repeat', 'obsgroup', 'obs', 'orderTemplate', 'order', 'appointments', 'uiInclude'):
                cnt[t] += 1
        w(', '.join('%s=%d' % kv for kv in sorted(cnt.items())))
        own_findings = [x for x in seenF if x[0] == f or (x[0] == '(form)' and (f + ':') in x[3])]
        trivial = (not cond_rows) and (not js_rows) and (not own_findings) and not cnt.get('postSubmissionAction') and not cnt.get('drugOrder')
        w('\ntrivial=%s  (own conditions=%d, own scripts=%d, own findings=%d)' % (trivial, len(cond_rows), len(js_rows), len(own_findings)))
        open(os.path.join(OUT, os.path.basename(f).replace('.xml', '.inv.md')), 'w').write('\n'.join(L) + '\n')
        summary[f] = {'findings': len(F), 'own_findings': len(own_findings), 'trivial': trivial, 'uuid': r.get('formUuid'), 'encounterType': r.get('formEncounterType')}
    json.dump(summary, open(os.path.join(OUT, 'summary.json'), 'w'), indent=1)
    print(len(summary), 'forms;', sum(1 for v in summary.values() if v['trivial']), 'trivial (nothing conditional or scripted of their own);', sum(1 for v in summary.values() if v['own_findings']), 'with own mechanical findings')
    if UNRESOLVED:
        stale = sorted(c for c, a in UNRESOLVED.items() if a)
        real = sorted(c for c, a in UNRESOLVED.items() if not a)
        print('concepts not in %s (date %s): %d distinct; %d only used in files committed after that date (regenerate the CSV); %d to check: %s' % (os.path.basename(CSV_MAP), csv_date(), len(UNRESOLVED), len(stale), len(real), ', '.join(real[:40])))
    uu = defaultdict(list)
    for k, v in summary.items():
        uu[v['uuid']].append(k)
    for k, v in uu.items():
        if len(v) > 1:
            print('shared uuid', k, v)


def e2e_up_to_date(xml, e2e):
    """True if the spec exists and the XML has not changed since it was written."""
    if not os.path.exists(e2e):
        return False
    import subprocess
    def git(*a):
        return subprocess.run(['git', '-C', os.path.dirname(xml)] + list(a), capture_output=True, text=True)
    last = git('log', '-1', '--format=%H', '--', e2e).stdout.strip()
    if last and not git('status', '--porcelain', '--', e2e).stdout.strip():
        return git('diff', '--quiet', last, '--', xml).returncode == 0 and not git('status', '--porcelain', '--', xml).stdout.strip()
    return os.path.getmtime(xml) <= os.path.getmtime(e2e)  # spec untracked or being edited


def check_coverage():
    """Every form of the merged htmlforms directory has a spec or is accounted for in _availability.e2e.md."""
    merged_forms = os.path.join(MERGED, 'htmlforms')
    roots = [merged_forms] if os.path.isdir(merged_forms) else [FORMS]
    if roots == [FORMS]:
        print('WARNING: no merged directory (%s): only the forms of %s are checked, inherited forms are missed. Build the distro or pass --merged-dir.' % (merged_forms, FORMS), file=sys.stderr)
    versioned = re.compile(r'_v\d|_Version\d|_old')
    forms, n_versioned, n_retired = {}, 0, 0
    for root_dir in roots:
        for d, subdirs, files in os.walk(root_dir):
            rel = os.path.relpath(d, root_dir)
            parts = rel.split(os.sep)
            if 'documentation' in parts:
                continue
            for f in files:
                if not f.endswith('.xml'):
                    continue
                if versioned.search(f):
                    n_versioned += 1
                elif 'retired' in parts:
                    n_retired += 1
                else:
                    forms[f[:-4]] = os.path.normpath(os.path.join(rel, f))
    specs = set()
    if os.path.isdir(ARGS.specs_dir):
        for name in os.listdir(ARGS.specs_dir):
            if os.path.exists(os.path.join(ARGS.specs_dir, name, name + '.spec.ts')):
                specs.add(name)
    # forms named in the "Not reachable" / "Not covered" sections of the availability file
    listed = {'reachable': set(), 'covered': set()}
    if os.path.exists(ARGS.availability_file):
        section = None
        for ln in open(ARGS.availability_file, encoding='utf-8'):
            m = re.match(r'^#{1,6}\s+(.*)', ln)
            if m:
                h = m.group(1).lower()
                section = 'reachable' if 'not reachable' in h else 'covered' if 'not covered' in h else None
                continue
            if section:
                for name in re.findall(r'([\w.\-]+)\.xml', ln):
                    listed[section].add(name)
    else:
        print('WARNING: %s not found: nothing counts as listed' % ARGS.availability_file, file=sys.stderr)
    not_reachable = {n for n in forms if n not in specs and n in listed['reachable']}
    not_covered = {n for n in forms if n not in specs and n not in not_reachable and n in listed['covered']}
    missing = sorted(n for n in forms if n not in specs and n not in not_reachable and n not in not_covered)
    stale = sorted(n for n in specs if n not in forms and not n.startswith('_') and n not in versioned_names(roots))
    print('%d forms in %s (+ %d versioned copies and %d retired, not counted): %d with a spec, %d listed as not reachable, %d listed as not covered, %d UNACCOUNTED'
          % (len(forms), ', '.join(roots), n_versioned, n_retired, sum(1 for n in forms if n in specs), len(not_reachable), len(not_covered), len(missing)))
    if missing:
        print('UNACCOUNTED (no spec, and not named in a "Not reachable" or "Not covered" section of %s):' % ARGS.availability_file)
        for n in missing:
            print('  ', forms[n])
    if stale:
        print('SPECS WITHOUT A FORM (renamed, retired or flow specs: check):', ', '.join(stale))
    # a form listed as not reachable that has a spec is fine (direct URL), but say so: it must be flagged @unreachable
    both = sorted(n for n in forms if n in specs and n in listed['reachable'])
    if both:
        print('not reachable but specced (the spec must say so: @unreachable in its test titles and a header line):', ', '.join(both))
    return 1 if missing else 0


def versioned_names(roots):
    names = set()
    for root_dir in roots:
        for d, subdirs, files in os.walk(root_dir):
            for f in files:
                if f.endswith('.xml') and re.search(r'_v\d|_Version\d|_old', f):
                    names.add(f[:-4])
    return names


if ARGS.check_coverage:
    sys.exit(check_coverage())
main()
