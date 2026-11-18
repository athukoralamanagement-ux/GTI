import ProductDiscount from "../models/ProductDiscount.js";

export const getLegacySalePrice = (product) => {
  const price = Number(product?.price) || 0;
  const discountPrice = Number(product?.discountPrice) || 0;
  return discountPrice > 0 && discountPrice < price ? discountPrice : price;
};

export const discountPriceFor = (product, discount) => {
  if (!discount) return getLegacySalePrice(product);
  const percentage = Math.max(0, Math.min(100, Number(discount.percentage) || 0));
  return Math.round((Number(product.price) * (1 - percentage / 100)) * 100) / 100;
};

export const activeDiscountQuery = (productIds, now = new Date()) => ProductDiscount.find({
  product: { $in: productIds }, active: true, startDate: { $lte: now }, endDate: { $gt: now }
}).lean();

export const decorateProductsWithDiscounts = async (products, now = new Date()) => {
  const plain = products.map((product) => product.toObject ? product.toObject() : product);
  if (!plain.length) return plain;
  const discounts = await activeDiscountQuery(plain.map((product) => product._id), now);
  const discountByProduct = new Map(discounts.map((discount) => [String(discount.product), discount]));
  return plain.map((product) => {
    const activeDiscount = discountByProduct.get(String(product._id));
    if (!activeDiscount) return product;
    const scheduledDiscountPrice = discountPriceFor(product, activeDiscount);
    return { ...product, scheduledDiscountPrice, activeDiscount: { _id: activeDiscount._id, percentage: activeDiscount.percentage, startDate: activeDiscount.startDate, endDate: activeDiscount.endDate } };
  });
};
