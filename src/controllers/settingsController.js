import asyncHandler from "express-async-handler";
import Setting from "../models/Setting.js";

// @desc    Get settings
// @route   GET /api/settings
// @access  Public
export const getSettings = asyncHandler(async (req, res) => {
  let settings = await Setting.findOne();
  if (!settings) {
    settings = await Setting.create({
      shippingFee: 500,
      freeShippingThreshold: 15000,
      websiteShippingCost: 0,
      proformaShippingCost: 0,
      categoryCosts: {},
      productCosts: {}
    });
  }
  res.json(settings);
});

// @desc    Update settings
// @route   PUT /api/settings
// @access  Private/Admin
export const updateSettings = asyncHandler(async (req, res) => {
  const { shippingFee, freeShippingThreshold, websiteShippingCost, proformaShippingCost, categoryCosts, productCosts } = req.body;

  if (shippingFee === undefined && freeShippingThreshold === undefined && websiteShippingCost === undefined && proformaShippingCost === undefined && categoryCosts === undefined && productCosts === undefined) {
    res.status(400);
    throw new Error("Please provide at least one setting to update");
  }

  let settings = await Setting.findOne();
  if (!settings) {
    settings = new Setting();
  }

  if (shippingFee !== undefined) settings.shippingFee = Math.max(0, Number(shippingFee) || 0);
  if (freeShippingThreshold !== undefined) settings.freeShippingThreshold = Math.max(0, Number(freeShippingThreshold) || 0);
  if (websiteShippingCost !== undefined) settings.websiteShippingCost = Math.max(0, Number(websiteShippingCost) || 0);
  if (proformaShippingCost !== undefined) settings.proformaShippingCost = Math.max(0, Number(proformaShippingCost) || 0);
  if (categoryCosts !== undefined) settings.categoryCosts = categoryCosts;
  if (productCosts !== undefined) settings.productCosts = productCosts;

  const updatedSettings = await settings.save();
  res.json(updatedSettings);
});
