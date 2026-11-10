'use client';

import type { MonthlyBoardDto } from '@academy/contracts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { MonthlyBoard } from '../../components/board/monthly-board';
import { PageContainer } from '../../components/ui/page-container';
import { ApiClientError, apiRequest } from '../../lib/api-client';
import { shiftMonth } from '../../lib/board';

export default function BoardPage() {
  const [month, setMonth] = useState<string | null>(null);
  const [data, setData] = useState<MonthlyBoardDto | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (value: string | null) => {
    setLoading(true);
    setError('');
    try {
      setData(
        await apiRequest<MonthlyBoardDto>(`/dashboard/monthly${value ? `?month=${value}` : ''}`),
      );
    } catch (failure) {
      setError(
        failure instanceof ApiClientError ? failure.message : 'No se pudo cargar el tablero.',
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => void load(month), [load, month]);

  const shown = data?.month ?? month;
  const isLatest = !data || data.month >= data.businessDate.slice(0, 7);
  return (
    <PageContainer className="board-page" width="wide">
      <header className="board-head">
        <div>
          <h1>Tablero</h1>
          <p>
            {data
              ? `${data.label}${data.inProgress ? ' (en curso)' : ''}, comparado con ${data.history.at(-2)!.label.toLowerCase()}`
              : 'Cómo viene la academia mes a mes'}
          </p>
        </div>
        <div className="board-month">
          <button
            aria-label="Mes anterior"
            className="secondary shell-icon-button"
            disabled={loading || !shown}
            onClick={() => shown && setMonth(shiftMonth(shown, -1))}
            type="button"
          >
            <ChevronLeft aria-hidden="true" size={16} />
          </button>
          <strong aria-live="polite">{data?.label ?? '…'}</strong>
          <button
            aria-label="Mes siguiente"
            className="secondary shell-icon-button"
            disabled={loading || isLatest}
            onClick={() => shown && setMonth(shiftMonth(shown, 1))}
            type="button"
          >
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        </div>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}{' '}
          <button className="secondary" onClick={() => void load(month)} type="button">
            Reintentar
          </button>
        </p>
      )}
      {!data && loading && (
        <p aria-busy="true" role="status">
          Cargando el tablero…
        </p>
      )}
      {data && (
        <div aria-busy={loading} className="board-body">
          <MonthlyBoard data={data} />
        </div>
      )}
    </PageContainer>
  );
}
