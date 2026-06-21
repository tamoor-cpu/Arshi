// Auto-reorder: when a chemical or inventory item drops to/below its reorder
// point, create a pending purchase order automatically (one per item at a time).

async function maybeAutoReorder(prisma, { locationId, itemName, supplier, qty, unit, costPerUnit }) {
  try {
    // Skip if there's already an open auto-order for this item at this location.
    const open = await prisma.purchaseOrder.findFirst({
      where: {
        locationId,
        autoCreated: true,
        status: { in: ['pending', 'ordered'] },
        itemsJson: { contains: `"name":"${itemName.replace(/"/g, '\\"')}"` },
      },
    });
    if (open) return null;

    const count = await prisma.purchaseOrder.count({ where: { locationId } });
    const items = [{ name: itemName, qty: qty || 1, unit: unit || 'each', cost: costPerUnit || 0 }];
    const order = await prisma.purchaseOrder.create({
      data: {
        locationId,
        poNumber: 'PO-' + String(1001 + count),
        supplier: supplier || null,
        itemsJson: JSON.stringify(items),
        totalCost: (costPerUnit || 0) * (qty || 1),
        autoCreated: true,
        notes: `Auto-generated: ${itemName} fell below its reorder point.`,
      },
    });
    return order;
  } catch (err) {
    console.error('Auto-reorder error:', err);
    return null;
  }
}

module.exports = { maybeAutoReorder };
