export const CATALOG=[
  {slug:'tripo',name:'Tripo3D Studio',eyebrow:'MODEL · CONVERTER',description:'Manajemen file 3D dan konversi lokal untuk aset yang kamu miliki atau boleh diunduh.',features:['GLB / GLTF','Konversi lokal','Browser extension'],image:'/assets/tripo.svg'},
  {slug:'meshy',name:'Meshy 3D Tools',eyebrow:'WORKFLOW · 3D',description:'Akses workflow untuk file dan model Meshy milikmu; tidak membuka paywall atau aset terlindungi.',features:['Model milik sendiri','GLB tools','License per perangkat'],image:'/assets/meshy.svg'},
  {slug:'sketchfab-textures',name:'Sketchfab Texture Kit',eyebrow:'TEXTURE · MATERIALS',description:'Paket workflow tekstur untuk model yang diizinkan pemiliknya, termasuk ekstraksi texture GLB lokal.',features:['Texture PNG','GLB lokal','Material workflow'],image:'/assets/textures.svg'},
  {slug:'sketchfab-model',name:'Sketchfab Model Kit',eyebrow:'MODEL · LIBRARY',description:'Pengelolaan file 3D Sketchfab dengan hak unduh yang sah; tidak membobol viewer terlindungi.',features:['Asset berizin','GLB import','License per perangkat'],image:'/assets/sketchfab.svg'}
];
export const isTool=slug=>CATALOG.some(t=>t.slug===slug);
export const defaultPrices=Object.fromEntries(CATALOG.map(p=>[p.slug,null]));
