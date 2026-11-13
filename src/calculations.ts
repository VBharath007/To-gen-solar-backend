/** Extracted QuotationEditor calculation semantics: integer paise, floor discount,
 * manual aggregate tax versus rounded per-line tax. Supports both tax inclusive and exclusive. */
export function calculateQuotation(input:any) {
  const dto=structuredClone(input), items=dto.items || [];
  const percent=dto.discount_percent!==undefined ? Number(dto.discount_percent) : (dto.subtotal>0 ? Number(dto.total_discount||0)/dto.subtotal*100:0);
  if(!Number.isFinite(percent)||percent<0||percent>20)throw new Error('Quotation discount must be between 0% and 20%');
  let subtotal=0,total_tax=0;
  const isTaxInclusive = !!dto.tax_inclusive;
  const manual=dto.manual_tax_rate!==undefined && dto.manual_tax_rate!=='' && dto.manual_tax_rate!==null;
  const tax=manual?Number(dto.manual_tax_rate):null;
  if(manual&&(!Number.isFinite(tax)||tax!<0))throw new Error('Invalid tax rate');
  for(const item of items) {
    const quantity=Number(item.quantity), rate=Number(item.unit_price),discount=Number(item.discount||0);
    if(!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(rate)||rate<0||!Number.isFinite(discount)||discount<0||discount>rate*quantity)throw new Error('Invalid line quantity, price or discount');
    const base=quantity*rate-discount;
    if(manual)item.tax_rate=tax;
    const r=Number(item.tax_rate||0);
    let lineTax=0;
    if(isTaxInclusive) {
      lineTax = Math.round(base - (base / (1 + r/100)));
      item.total = base;
    } else {
      lineTax = Math.round(base*r/100);
      item.total = base+lineTax;
    }
    subtotal+=base;total_tax+=lineTax;
  }
  if(!items.length){subtotal=Number(dto.subtotal||0);total_tax=Number(dto.total_tax||0);}
  if(manual){
    if(isTaxInclusive) {
      total_tax = Math.round(subtotal - (subtotal / (1 + tax!/100)));
    } else {
      total_tax = Math.round(subtotal*tax!/100);
    }
  }
  const total_discount=Math.floor(Math.max(0,Math.round(subtotal))*percent/100);
  if(!Number.isFinite(subtotal)||!Number.isFinite(total_tax)||subtotal<0||total_tax<0)throw new Error('Invalid quotation totals');
  const grand_total = isTaxInclusive ? (subtotal - total_discount) : (subtotal + total_tax - total_discount);
  return {...dto,items,subtotal,total_tax,total_discount,grand_total};
}
