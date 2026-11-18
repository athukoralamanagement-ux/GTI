const spec = (label, value) => ({ label, value });

const products = [
  // Laptops
  {
    name: "GTI UltraBook Pro 14",
    slug: "gti-ultrabook-pro-14",
    category: "Laptops",
    brand: "GTI",
    price: 289000,
    unit: "2-year warranty",
    stock: 14,
    emoji: "UBK",
    color: "#2b6cb0",
    description: "A 14-inch aluminium ultrabook with an Intel Core Ultra 7, 16GB RAM and a 1TB NVMe SSD for effortless everyday work.",
    image: "/assets/products/gti-ultrabook-pro-14.svg",
    featured: true,
    specs: [
      spec("Processor", "Intel Core Ultra 7 155H"),
      spec("Graphics", "Intel Arc integrated"),
      spec("Memory", "16GB LPDDR5"),
      spec("Storage", "1TB NVMe SSD"),
      spec("Display", "14-inch 2.8K OLED"),
      spec("Resolution", "2880 x 1800"),
      spec("Refresh rate", "120Hz"),
      spec("Operating system", "Windows 11 Home")
    ]
  },
  {
    name: "GTI CreatorBook 16",
    slug: "gti-creatorbook-16",
    category: "Laptops",
    brand: "GTI",
    price: 419000,
    unit: "2-year warranty",
    stock: 6,
    emoji: "CRB",
    color: "#553c9a",
    description: "A 16-inch creator laptop with a colour-accurate 2.8K display, RTX 4060 graphics and 32GB of memory for editing on the go.",
    image: "/assets/products/gti-creatorbook-16.svg",
    featured: true,
    specs: [
      spec("Processor", "Intel Core Ultra 9 185H"),
      spec("Graphics", "NVIDIA GeForce RTX 4060 8GB"),
      spec("Memory", "32GB DDR5"),
      spec("Storage", "1TB NVMe SSD"),
      spec("Display", "16-inch 2.8K OLED"),
      spec("Resolution", "2880 x 1800"),
      spec("Refresh rate", "120Hz"),
      spec("Operating system", "Windows 11 Pro")
    ]
  },
  {
    name: "GTI Gaming Rig X6",
    slug: "gti-gaming-rig-x6",
    category: "Desktops",
    brand: "GTI",
    price: 549000,
    unit: "3-year warranty",
    stock: 8,
    emoji: "RGX",
    color: "#1a202c",
    description: "A hand-built gaming desktop with a Ryzen 7 7800X3D, RTX 4070 Super and 2TB of NVMe storage. Stress-tested and cable-managed.",
    image: "/assets/products/gti-gaming-rig-x6.svg",
    featured: true,
    specs: [
      spec("Processor", "AMD Ryzen 7 7800X3D"),
      spec("Graphics", "NVIDIA GeForce RTX 4070 Super 12GB"),
      spec("Memory", "32GB DDR5 6000MHz"),
      spec("Storage", "2TB NVMe SSD"),
      spec("Motherboard", "B650 AM5"),
      spec("Power supply", "850W 80+ Gold"),
      spec("Operating system", "Windows 11 Home")
    ]
  },
  {
    name: "GTI Office Mini PC",
    slug: "gti-office-mini-pc",
    category: "Desktops",
    brand: "GTI",
    price: 129000,
    unit: "2-year warranty",
    stock: 21,
    emoji: "MPC",
    color: "#2f855a",
    description: "A compact, near-silent mini PC with a Ryzen 5 8600G, 16GB RAM and 512GB SSD. Ideal for home offices and study desks.",
    image: "/assets/products/gti-office-mini-pc.svg",
    featured: false,
    specs: [
      spec("Processor", "AMD Ryzen 5 8600G"),
      spec("Graphics", "AMD Radeon 760M"),
      spec("Memory", "16GB DDR5"),
      spec("Storage", "512GB NVMe SSD"),
      spec("Connectivity", "WiFi 6, Bluetooth 5.2"),
      spec("Operating system", "Windows 11 Home")
    ]
  },
  {
    name: "GTI All-in-One 27",
    slug: "gti-all-in-one-27",
    category: "Desktops",
    brand: "GTI",
    price: 299000,
    unit: "2-year warranty",
    stock: 11,
    emoji: "AIO",
    color: "#4c51bf",
    description: "A 27-inch QHD all-in-one with a built-in webcam, speakers and wireless keyboard and mouse. One cable, zero clutter.",
    image: "/assets/products/gti-all-in-one-27.svg",
    featured: true,
    specs: [
      spec("Processor", "AMD Ryzen 7 8845HS"),
      spec("Graphics", "AMD Radeon 780M"),
      spec("Memory", "16GB DDR5"),
      spec("Storage", "1TB NVMe SSD"),
      spec("Display", "27-inch QHD IPS"),
      spec("Resolution", "2560 x 1440"),
      spec("Refresh rate", "100Hz"),
      spec("Operating system", "Windows 11 Home")
    ]
  },

  // Components
  {
    name: "NVIDIA GeForce RTX 4070 Super",
    slug: "nvidia-geforce-rtx-4070-super",
    category: "Components",
    brand: "NVIDIA",
    price: 265000,
    unit: "3-year warranty",
    stock: 9,
    emoji: "GPU",
    color: "#38a169",
    description: "12GB GDDR6X graphics with DLSS 3 and ray tracing for high-refresh 1440p gaming and GPU-accelerated creative work.",
    image: "/assets/products/nvidia-geforce-rtx-4070-super.svg",
    featured: true,
    specs: [
      spec("Graphics", "NVIDIA GeForce RTX 4070 Super"),
      spec("Memory", "12GB GDDR6X"),
      spec("Interface", "PCIe 4.0 x16"),
      spec("Power", "750W recommended"),
      spec("Outputs", "3x DisplayPort, 1x HDMI 2.1")
    ]
  },
  {
    name: "AMD Ryzen 7 7800X3D",
    slug: "amd-ryzen-7-7800x3d",
    category: "Components",
    brand: "AMD",
    price: 159000,
    unit: "3-year warranty",
    stock: 13,
    emoji: "CPU",
    color: "#c05621",
    description: "8-core, 16-thread gaming processor with 3D V-Cache for exceptional frame rates across modern titles.",
    image: "/assets/products/amd-ryzen-7-7800x3d.svg",
    featured: true,
    specs: [
      spec("Processor", "AMD Ryzen 7 7800X3D"),
      spec("Cores / threads", "8 cores / 16 threads"),
      spec("Socket", "AM5"),
      spec("Memory support", "DDR5-5200"),
      spec("TDP", "120W"),
      spec("Cache", "96MB 3D V-Cache")
    ]
  },
  {
    name: "Samsung 990 Pro 1TB NVMe SSD",
    slug: "samsung-990-pro-1tb",
    category: "Components",
    brand: "Samsung",
    price: 49000,
    unit: "5-year warranty",
    stock: 32,
    emoji: "SSD",
    color: "#2d3748",
    description: "PCIe 4.0 NVMe storage with sequential reads up to 7,450 MB/s for faster boots, loads and large file transfers.",
    image: "/assets/products/samsung-990-pro-1tb.svg",
    featured: false,
    specs: [
      spec("Storage", "1TB NVMe PCIe 4.0"),
      spec("Read / write", "7450 / 6900 MB/s"),
      spec("Form factor", "M.2 2280"),
      spec("Interface", "PCIe 4.0 x4")
    ]
  },
  {
    name: "Corsair Vengeance 32GB DDR5",
    slug: "corsair-vengeance-32gb-ddr5",
    category: "Components",
    brand: "Corsair",
    price: 38000,
    unit: "Lifetime warranty",
    stock: 27,
    emoji: "RAM",
    color: "#805ad5",
    description: "A 2x16GB DDR5-6000 kit with low-profile heat spreaders and EXPO/XMP profiles for one-click stable performance.",
    image: "/assets/products/corsair-vengeance-32gb-ddr5.svg",
    featured: false,
    specs: [
      spec("Memory", "32GB (2x16GB) DDR5-6000"),
      spec("Latency", "CL30"),
      spec("Profile", "AMD EXPO / Intel XMP 3.0"),
      spec("Form factor", "DIMM")
    ]
  },

  // Monitors
  {
    name: "Samsung Odyssey G5 27\"",
    slug: "samsung-odyssey-g5-27",
    category: "Monitors",
    brand: "Samsung",
    price: 119000,
    unit: "3-year warranty",
    stock: 15,
    emoji: "G5",
    color: "#2b6cb0",
    description: "A 27-inch QHD gaming monitor with a 165Hz refresh rate, 1ms response and HDR10 for smooth, vivid gameplay.",
    image: "/assets/products/samsung-odyssey-g5-27.svg",
    featured: true,
    specs: [
      spec("Display", "27-inch QHD"),
      spec("Resolution", "2560 x 1440"),
      spec("Refresh rate", "165Hz"),
      spec("Panel", "VA"),
      spec("Response time", "1ms MPRT"),
      spec("Connectivity", "HDMI 2.0, DisplayPort 1.2")
    ]
  },
  {
    name: "LG UltraWide 29\"",
    slug: "lg-ultrawide-29",
    category: "Monitors",
    brand: "LG",
    price: 145000,
    unit: "3-year warranty",
    stock: 7,
    emoji: "UW",
    color: "#4a5568",
    description: "A 29-inch 21:9 ultrawide IPS display with 99% sRGB coverage, perfect for multitasking and creative timelines.",
    image: "/assets/products/lg-ultrawide-29.svg",
    featured: false,
    specs: [
      spec("Display", "29-inch ultrawide"),
      spec("Resolution", "2560 x 1080"),
      spec("Refresh rate", "75Hz"),
      spec("Panel", "IPS"),
      spec("Aspect ratio", "21:9"),
      spec("Connectivity", "HDMI, DisplayPort")
    ]
  },
  {
    name: "GTI 24\" FHD IPS Monitor",
    slug: "gti-24-fhd-ips-monitor",
    category: "Monitors",
    brand: "GTI",
    price: 49900,
    unit: "3-year warranty",
    stock: 24,
    emoji: "24M",
    color: "#3182ce",
    description: "A 24-inch 1080p IPS monitor with slim bezels, HDMI and DisplayPort - a dependable everyday office and study screen.",
    image: "/assets/products/gti-24-fhd-ips-monitor.svg",
    featured: false,
    specs: [
      spec("Display", "24-inch FHD"),
      spec("Resolution", "1920 x 1080"),
      spec("Refresh rate", "100Hz"),
      spec("Panel", "IPS"),
      spec("Connectivity", "HDMI, DisplayPort, VGA")
    ]
  },

  // Peripherals
  {
    name: "Logitech MX Master 3S",
    slug: "logitech-mx-master-3s",
    category: "Peripherals",
    brand: "Logitech",
    price: 34500,
    unit: "1-year warranty",
    stock: 19,
    emoji: "MX3",
    color: "#2d3748",
    description: "A precision wireless mouse with an 8K DPI sensor, quiet clicks and multi-device Flow control for serious productivity.",
    image: "/assets/products/logitech-mx-master-3s.svg",
    featured: true,
    specs: [
      spec("Type", "Wireless mouse"),
      spec("Connectivity", "Bluetooth / Logi Bolt"),
      spec("Sensor", "8000 DPI"),
      spec("Battery", "Up to 70 days"),
      spec("Buttons", "7 programmable")
    ]
  },
  {
    name: "Keychron K8 Pro",
    slug: "keychron-k8-pro",
    category: "Peripherals",
    brand: "Keychron",
    price: 42000,
    unit: "1-year warranty",
    stock: 12,
    emoji: "K8P",
    color: "#744210",
    description: "A hot-swappable 87-key mechanical keyboard with QMK/VIA support, Bluetooth and a solid aluminium frame.",
    image: "/assets/products/keychron-k8-pro.svg",
    featured: true,
    specs: [
      spec("Type", "Mechanical keyboard"),
      spec("Layout", "87-key TKL"),
      spec("Connectivity", "Bluetooth 5.1 / USB-C"),
      spec("Switch", "Hot-swappable Gateron Pro"),
      spec("Battery", "4000mAh")
    ]
  },
  {
    name: "HyperX Cloud III",
    slug: "hyperx-cloud-iii",
    category: "Peripherals",
    brand: "HyperX",
    price: 32000,
    unit: "2-year warranty",
    stock: 16,
    emoji: "CL3",
    color: "#c53030",
    description: "Comfortable over-ear gaming headset with 53mm angled drivers, a detachable mic and multi-platform connectivity.",
    image: "/assets/products/hyperx-cloud-iii.svg",
    featured: false,
    specs: [
      spec("Type", "Gaming headset"),
      spec("Connectivity", "USB-C / 3.5mm"),
      spec("Drivers", "53mm angled"),
      spec("Microphone", "Detachable noise-cancelling"),
      spec("Compatibility", "PC, PS5, Xbox, mobile")
    ]
  },

  // Networking
  {
    name: "TP-Link Archer AX55",
    slug: "tp-link-archer-ax55",
    category: "Networking",
    brand: "TP-Link",
    price: 28500,
    unit: "3-year warranty",
    stock: 23,
    emoji: "AX5",
    color: "#2c7a7b",
    description: "A dual-band WiFi 6 router with speeds up to 3000 Mbps, OFDMA and WPA3 for fast, secure home coverage.",
    image: "/assets/products/tp-link-archer-ax55.svg",
    featured: true,
    specs: [
      spec("Type", "WiFi 6 router"),
      spec("Speed", "AX3000"),
      spec("Bands", "Dual-band"),
      spec("Ports", "Gigabit WAN / LAN"),
      spec("Security", "WPA3")
    ]
  },
  {
    name: "GTI Mesh WiFi 6 Kit",
    slug: "gti-mesh-wifi-6-kit",
    category: "Networking",
    brand: "GTI",
    price: 54000,
    unit: "2-year warranty",
    stock: 10,
    emoji: "MSH",
    color: "#2f855a",
    description: "A 2-unit whole-home mesh system covering up to 4,000 sq ft with seamless roaming and app-based setup.",
    image: "/assets/products/gti-mesh-wifi-6-kit.svg",
    featured: true,
    specs: [
      spec("Type", "Mesh WiFi system"),
      spec("Coverage", "Up to 4,000 sq ft"),
      spec("Speed", "AX3000"),
      spec("Units", "2-pack"),
      spec("Security", "WPA3")
    ]
  },

  // Accessories
  {
    name: "Anker 100W GaN Charger",
    slug: "anker-100w-gan-charger",
    category: "Accessories",
    brand: "Anker",
    price: 18500,
    unit: "18-month warranty",
    stock: 34,
    emoji: "100",
    color: "#2b6cb0",
    description: "A compact 100W GaN wall charger with three ports to fast-charge laptops, phones and tablets from a single plug.",
    image: "/assets/products/anker-100w-gan-charger.svg",
    featured: true,
    specs: [
      spec("Type", "GaN wall charger"),
      spec("Output", "100W total"),
      spec("Ports", "2x USB-C, 1x USB-A"),
      spec("Compatibility", "Laptops, phones, tablets")
    ]
  }
];

export default products;
