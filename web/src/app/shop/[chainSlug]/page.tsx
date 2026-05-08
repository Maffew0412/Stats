import { ShoppingMode } from '@/components/ShoppingMode';

export default async function ShopPage({
  params,
}: {
  params: Promise<{ chainSlug: string }>;
}) {
  const { chainSlug } = await params;
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <ShoppingMode chainSlug={chainSlug} />
    </div>
  );
}
