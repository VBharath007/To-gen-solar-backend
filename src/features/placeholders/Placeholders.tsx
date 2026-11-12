import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';

export default function Placeholders({ title }: { title: string }) {
  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <PageHeader 
        title={title} 
        description={`The ${title.toLowerCase()} module is currently pending backend integration.`} 
      />
      
      <div className="mt-8">
        <EmptyState 
          icon="🚧"
          title="Under Construction"
          description={`This screen is mapped in the layout but the underlying features for ${title} have not been built in the SQLite backend yet. Check back in the next milestone!`}
        />
      </div>
    </div>
  );
}
