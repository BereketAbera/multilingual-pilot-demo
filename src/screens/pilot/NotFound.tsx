import { Link } from 'react-router';
import { PageHeader } from '../../components/ui';
import { Msg, useI18n } from '../../i18n';
import { usePageTitle } from '../../lib/usePageTitle';

export default function NotFound() {
  const { t } = useI18n();
  usePageTitle(t('common:notFound.title'));
  return (
    <>
      <PageHeader title={<Msg id="common:notFound.title" />}>
        <Msg id="common:notFound.body" />
      </PageHeader>
      <Link className="text-action underline underline-offset-2" to="/orders">
        <Msg id="common:notFound.back" />
      </Link>
    </>
  );
}
