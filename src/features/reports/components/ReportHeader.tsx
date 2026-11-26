import { useMutation } from '@tanstack/react-query';
import { Download, Printer } from 'lucide-react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { reportsApi, type ReportKind } from '@/api/analytics.api';
import { getErrorMessage } from '@/api/http';
import { Button, PageHeader } from '@/components/ui';

/**
 * Report title card (layout of the reference): title, a line of key facts
 * ("203 заказов · оплачено 193 · отменено 0"), print and Excel on the right.
 * Excel exports exactly the filters on screen.
 */
export function ReportHeader({
  title,
  facts,
  kind,
  exportParams,
  onPrint,
  printLabel = 'Печать',
  printing,
  printDisabled,
}: {
  title: string;
  facts?: ReactNode;
  kind: ReportKind;
  exportParams: object;
  onPrint?: () => void;
  printLabel?: string;
  printing?: boolean;
  printDisabled?: boolean;
}) {
  const download = useMutation({
    mutationFn: (params: object) => reportsApi.export(kind, params),
    onError: (error) => toast.error(getErrorMessage(error, 'Не удалось выгрузить отчёт')),
  });

  return (
    <PageHeader
      title={title}
      subtitle={facts}
      actions={
        <>
          {onPrint && (
            <Button
              variant="secondary"
              leftIcon={<Printer className="size-4" />}
              loading={printing}
              disabled={printDisabled}
              onClick={onPrint}
            >
              {printLabel}
            </Button>
          )}
          <Button
            variant="secondary"
            leftIcon={<Download className="size-4" />}
            loading={download.isPending}
            onClick={() => download.mutate(exportParams)}
          >
            Excel
          </Button>
        </>
      }
    />
  );
}
