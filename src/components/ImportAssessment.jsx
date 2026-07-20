// Import a previously exported assessment record from a .json file. Reads the
// file, guards that it is a well-formed record (object with a schema_version),
// warns on a version mismatch, then LOADs it and navigates on. Reusable from the
// Start page (resume from scratch) and the Export page.

import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAssessment, RECORD_VERSION } from '../state/assessment.jsx';

export default function ImportAssessment({
  className,
  children = 'Import assessment',
  to = '/review',
}) {
  const { dispatch } = useAssessment();
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so the same file can be re-imported
    if (!file) return;

    let record;
    try {
      record = JSON.parse(await file.text());
    } catch {
      window.alert('Could not read that file: it is not valid JSON.');
      return;
    }

    if (!record || typeof record !== 'object' || !record.schema_version) {
      window.alert('That file does not look like an exported assessment.');
      return;
    }

    if (record.schema_version !== RECORD_VERSION) {
      const ok = window.confirm(
        `This assessment was saved in format "${record.schema_version}", but this tool expects "${RECORD_VERSION}". Load it anyway? Some fields may not map.`,
      );
      if (!ok) return;
    }

    dispatch({ type: 'LOAD', record });
    if (to) navigate(to);
  };

  return (
    <>
      <button type="button" onClick={() => inputRef.current?.click()} className={className}>
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        onChange={onFile}
        className="hidden"
      />
    </>
  );
}
