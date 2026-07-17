// Assessment state: React Context + useReducer, mirrored to localStorage.
//
// The in-progress record is prototype-grade persistence (localStorage is
// per-origin/per-browser and disabled in private tabs); the durable, shareable
// artifact is the exported JSON profile. Record shape is versioned so imports
// from an older schema can be detected.

import { createContext, useContext, useEffect, useReducer } from 'react';

const STORAGE_KEY = 'ai-readiness-assessment';
export const RECORD_VERSION = 'assessment_record_v0';

export const emptyRecord = () => ({
  schema_version: RECORD_VERSION,
  pathway: null, // 'A' | 'B' | 'C'
  sub_domain: null, // Pathway C only
  started_at: null,
  answers: {}, // { [criterionId]: { value, notes } }
  croissant: null, // user-edited Croissant descriptor; null => generate from answers
  provo: null, // user-edited (raw) PROV-O record; overrides the builder when set
  // Structured, step-centric provenance the builder populates; generateProvo
  // composes the PROV-O graph from it. Empty => bare scaffold from answers.
  provenance: { sources: [], steps: [] },
});

export function reducer(state, action) {
  switch (action.type) {
    case 'SET_PATHWAY':
      return {
        ...state,
        pathway: action.pathway,
        sub_domain: action.pathway === 'C' ? (state.sub_domain ?? 'general') : null,
        started_at: state.started_at ?? new Date().toISOString(),
      };
    case 'SET_SUB_DOMAIN':
      return { ...state, sub_domain: action.sub_domain };
    case 'SET_ANSWER': {
      const prev = state.answers[action.id] ?? {};
      const next = { ...prev };
      if ('value' in action) next.value = action.value;
      if ('notes' in action) next.notes = action.notes;
      return { ...state, answers: { ...state.answers, [action.id]: next } };
    }
    case 'SET_CROISSANT':
      return { ...state, croissant: action.croissant };
    case 'SET_PROVO':
      return { ...state, provo: action.provo };
    case 'SET_PROVENANCE':
      return { ...state, provenance: action.provenance };
    case 'LOAD':
      return { ...emptyRecord(), ...action.record };
    case 'RESET':
      return emptyRecord();
    default:
      return state;
  }
}

function init() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.schema_version === RECORD_VERSION) {
        return { ...emptyRecord(), ...parsed };
      }
    }
  } catch {
    // private-mode tab, quota, or malformed JSON — fall back to a fresh record.
  }
  return emptyRecord();
}

const AssessmentContext = createContext(null);

export function AssessmentProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore persistence failures; the export flow is the durable path.
    }
  }, [state]);

  return (
    <AssessmentContext.Provider value={{ state, dispatch }}>
      {children}
    </AssessmentContext.Provider>
  );
}

export function useAssessment() {
  const ctx = useContext(AssessmentContext);
  if (!ctx) throw new Error('useAssessment must be used within an AssessmentProvider');
  return ctx;
}
