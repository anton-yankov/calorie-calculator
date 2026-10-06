import { WaterTrackingProvider } from "@/components/WaterTracking";
import { listSavedBarcodeProducts } from "@/lib/barcode-products";
import { createAdminClient } from "@/lib/supabase-admin";
import { ProductList } from "@/app/(app)/products/ProductList";
import { loadProfile, requireAdminOnce } from "../data";

/** The Products tab: the user's saved barcode products, read-only. */
export default async function AdminUserProductsPage(
  props: PageProps<"/admin/users/[userId]/products">,
) {
  await requireAdminOnce();
  const { userId } = await props.params;
  const [profile, products] = await Promise.all([
    loadProfile(userId),
    listSavedBarcodeProducts(userId, createAdminClient()),
  ]);
  return (
    // Water amounts follow this user's setting, not the admin's
    <WaterTrackingProvider enabled={profile?.waterTracking ?? false}>
      <ProductList products={products} readOnly />
    </WaterTrackingProvider>
  );
}
