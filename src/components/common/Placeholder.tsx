import { PageHeader } from './PageHeader';
import { EmptyState } from './EmptyState';

export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="animate-fade-in">
      <PageHeader title={title} />
      <EmptyState 
        icon="🚧" 
        title="Under Construction" 
        description={`The ${title} module is currently under development.`} 
      />
    </div>
  );
}
