// Canonical custom-PC component catalog.
//
// The storefront builder (client/src/pages/BuildPcPage.jsx) renders the same
// part IDs, but checkout always re-prices from this server-side copy. That
// means a tampered client price can never change what a customer is charged.
// Keep this list in sync with the builder UI when parts or prices change.

export const BUILD_CATEGORIES = [
  {
    id: "cpu",
    label: "Processor (CPU)",
    required: true,
    hint: "Intel Core Ultra or AMD Ryzen",
    options: [
      { _id: "build-cpu-1", name: "AMD Ryzen 7 7800X3D (8 Cores, 16 Threads, 5.0 GHz)", price: 159000, socket: "AM5", wattage: 120, warranty: "3-Year Warranty", brand: "AMD", image: "/assets/products/amd-ryzen-7-7800x3d.svg" },
      { _id: "build-cpu-2", name: "Intel Core Ultra 7 265K (20 Cores, up to 5.5 GHz)", price: 172000, socket: "LGA1851", wattage: 150, warranty: "3-Year Warranty", brand: "Intel", image: "/assets/products/amd-ryzen-7-7800x3d.svg" },
      { _id: "build-cpu-3", name: "AMD Ryzen 5 7600X (6 Cores, 12 Threads, 5.3 GHz)", price: 89000, socket: "AM5", wattage: 105, warranty: "3-Year Warranty", brand: "AMD", image: "/assets/products/amd-ryzen-7-7800x3d.svg" }
    ]
  },
  {
    id: "motherboard",
    label: "Motherboard",
    required: true,
    hint: "Compatible with your chosen CPU socket",
    options: [
      { _id: "build-mb-1", name: "ASUS TUF Gaming B650-PLUS WiFi DDR5", price: 84000, socket: "AM5", wattage: 35, warranty: "3-Year Warranty", brand: "ASUS", image: "/assets/cat_components.svg" },
      { _id: "build-mb-2", name: "MSI MAG Z790 Tomahawk MAX WiFi", price: 118000, socket: "LGA1851", wattage: 40, warranty: "3-Year Warranty", brand: "MSI", image: "/assets/cat_components.svg" },
      { _id: "build-mb-3", name: "Gigabyte B650 AORUS Elite AX ICE (White)", price: 96000, socket: "AM5", wattage: 35, warranty: "3-Year Warranty", brand: "Gigabyte", image: "/assets/cat_components.svg" }
    ]
  },
  {
    id: "gpu",
    label: "Graphics Card (GPU)",
    required: true,
    hint: "High-refresh 1440p / 4K gaming power",
    options: [
      { _id: "build-gpu-1", name: "NVIDIA GeForce RTX 4070 Super 12GB GDDR6X", price: 265000, wattage: 220, warranty: "3-Year Warranty", brand: "NVIDIA", image: "/assets/products/nvidia-geforce-rtx-4070-super.svg" },
      { _id: "build-gpu-2", name: "MSI GeForce RTX 4060 Ti Ventus 2X 8GB OC", price: 168000, wattage: 160, warranty: "3-Year Warranty", brand: "MSI", image: "/assets/products/nvidia-geforce-rtx-4070-super.svg" },
      { _id: "build-gpu-3", name: "ASUS ROG Strix GeForce RTX 4080 Super 16GB", price: 435000, wattage: 320, warranty: "3-Year Warranty", brand: "ASUS", image: "/assets/products/nvidia-geforce-rtx-4070-super.svg" }
    ]
  },
  {
    id: "ram",
    label: "Memory (RAM)",
    required: true,
    hint: "Dual-channel high speed memory",
    options: [
      { _id: "build-ram-1", name: "Corsair Vengeance 32GB (2x16GB) DDR5-6000MHz CL30", price: 38000, wattage: 15, warranty: "Lifetime Warranty", brand: "Corsair", image: "/assets/products/corsair-vengeance-32gb-ddr5.svg" },
      { _id: "build-ram-2", name: "Kingston FURY Beast RGB 32GB (2x16GB) DDR5-6000MHz", price: 42000, wattage: 15, warranty: "Lifetime Warranty", brand: "Kingston", image: "/assets/products/corsair-vengeance-32gb-ddr5.svg" },
      { _id: "build-ram-3", name: "Corsair Vengeance RGB 64GB (2x32GB) DDR5-6000MHz", price: 74000, wattage: 20, warranty: "Lifetime Warranty", brand: "Corsair", image: "/assets/products/corsair-vengeance-32gb-ddr5.svg" }
    ]
  },
  {
    id: "storage",
    label: "Storage (M.2 NVMe SSD)",
    required: true,
    hint: "Ultra-fast PCIe Gen4 / Gen5 storage",
    options: [
      { _id: "build-ssd-1", name: "Samsung 990 Pro 1TB PCIe 4.0 NVMe SSD (7,450 MB/s)", price: 49000, wattage: 8, warranty: "5-Year Warranty", brand: "Samsung", image: "/assets/products/samsung-990-pro-1tb.svg" },
      { _id: "build-ssd-2", name: "Samsung 990 Pro 2TB PCIe 4.0 NVMe SSD (7,450 MB/s)", price: 78000, wattage: 8, warranty: "5-Year Warranty", brand: "Samsung", image: "/assets/products/samsung-990-pro-1tb.svg" },
      { _id: "build-ssd-3", name: "Kingston KC3000 1TB PCIe 4.0 NVMe SSD (7,000 MB/s)", price: 38000, wattage: 8, warranty: "5-Year Warranty", brand: "Kingston", image: "/assets/products/samsung-990-pro-1tb.svg" }
    ]
  },
  {
    id: "cooler",
    label: "CPU Cooler",
    required: false,
    hint: "Liquid AIO or High-Performance Air Cooler",
    options: [
      { _id: "build-cooler-1", name: "Thermaltake TH360 V2 ARGB Sync 360mm Liquid Cooler", price: 36000, wattage: 15, warranty: "2-Year Warranty", brand: "Thermaltake", image: "/assets/cat_components.svg" },
      { _id: "build-cooler-2", name: "DeepCool AK620 Digital Dual-Tower ARGB Air Cooler", price: 24500, wattage: 8, warranty: "2-Year Warranty", brand: "DeepCool", image: "/assets/cat_components.svg" },
      { _id: "build-cooler-3", name: "Lian Li Galahad II Trinity 360 ARGB Liquid Cooler", price: 52000, wattage: 18, warranty: "3-Year Warranty", brand: "Lian Li", image: "/assets/cat_components.svg" }
    ]
  },
  {
    id: "psu",
    label: "Power Supply (PSU)",
    required: true,
    hint: "80 Plus Gold certified reliable power",
    options: [
      { _id: "build-psu-1", name: "Corsair RM750e 750W 80+ Gold Fully Modular ATX 3.0", price: 44000, wattageCapacity: 750, warranty: "5-Year Warranty", brand: "Corsair", image: "/assets/cat_components.svg" },
      { _id: "build-psu-2", name: "Corsair RM850x 850W 80+ Gold Fully Modular ATX 3.0", price: 58000, wattageCapacity: 850, warranty: "7-Year Warranty", brand: "Corsair", image: "/assets/cat_components.svg" },
      { _id: "build-psu-3", name: "Thermaltake Toughpower GF1 750W 80+ Gold", price: 39500, wattageCapacity: 750, warranty: "5-Year Warranty", brand: "Thermaltake", image: "/assets/cat_components.svg" }
    ]
  },
  {
    id: "case",
    label: "PC Case (Chassis)",
    required: true,
    hint: "Tempered glass & high airflow aesthetics",
    options: [
      { _id: "build-case-1", name: "NZXT H6 Flow Dual-Chamber Panoramic Tempered Glass (Black)", price: 38000, warranty: "2-Year Warranty", brand: "NZXT", image: "/assets/cat_desktops.svg" },
      { _id: "build-case-2", name: "Lian Li O11 Dynamic EVO RGB Dual-Chamber (White)", price: 64000, warranty: "2-Year Warranty", brand: "Lian Li", image: "/assets/cat_desktops.svg" },
      { _id: "build-case-3", name: "Montech Sky Two ARGB Curved Glass Mid-Tower (Black)", price: 29500, warranty: "2-Year Warranty", brand: "Montech", image: "/assets/cat_desktops.svg" }
    ]
  }
];

const BUILD_PART_MAP = new Map(
  BUILD_CATEGORIES.flatMap((category) =>
    category.options.map((option) => [option._id, { ...option, categoryId: category.id, categoryLabel: category.label }])
  )
);

export const findBuildPart = (partId) => BUILD_PART_MAP.get(String(partId || "")) || null;

export const buildPartCount = BUILD_PART_MAP.size;
