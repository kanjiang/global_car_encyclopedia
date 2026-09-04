# 通过 images.weserv.nl 代理下载 Wikimedia 车图到本地 images/ 目录
# （Wikimedia 在国内被墙，用境外代理中转下载，运行后即可完全离线显示）
#
# 用法：
#   .\download_images.ps1            只下载缺失的图（已存在的跳过）
#   .\download_images.ps1 -Force     全部重新下载
#
# 图片直接由代理转成 900px 宽的 WebP（q=72），无需再跑 optimize_images.py。

param([switch]$Force)

$dir = Join-Path $PSScriptRoot "images"
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }

# id -> Wikimedia 原图路径（不含 https:// 前缀）。
# 原图宽度 < 960px 的用 "orig:" 前缀标记，跳过缩略图（Wikimedia 不会放大生成）。
$map = [ordered]@{
  # ---- 超级跑车 ----
  "bugatti-chiron"        = "upload.wikimedia.org/wikipedia/commons/1/18/Bugatti_Chiron_1.jpg"
  "ferrari-f8"            = "upload.wikimedia.org/wikipedia/commons/f/f2/2020_Ferrari_F8_Tributo_3.9.jpg"
  "lamborghini-aventador" = "upload.wikimedia.org/wikipedia/commons/e/ed/Lamborghini_Aventador_S_%2844554%29.jpg"
  "koenigsegg-jesko"      = "upload.wikimedia.org/wikipedia/commons/9/9f/GIMS_2019%2C_Le_Grand-Saconnex_%28GIMS0833%29.jpg"
  "mclaren-720s"          = "upload.wikimedia.org/wikipedia/commons/2/23/2018_McLaren_720S_V8_S-A_4.0.jpg"
  "maserati-mc20"         = "upload.wikimedia.org/wikipedia/commons/b/bb/Maserati_MC20_IAA_2021_1X7A0087.jpg"
  "audi-r8"               = "upload.wikimedia.org/wikipedia/commons/d/d2/2018_Audi_R8_Coupe_V10_plus_Front.jpg"

  # ---- 跑车 ----
  "porsche-911"           = "upload.wikimedia.org/wikipedia/commons/a/a2/Porsche_911_No_1000000%2C_70_Years_Porsche_Sports_Car%2C_Berlin_%281X7A3888%29.jpg"
  "mazda-mx5"             = "upload.wikimedia.org/wikipedia/commons/9/95/Mazda_Roadster_%28MX-5%29_by_Negawa_Bridge_%28cropped%29.jpg"
  "nissan-gtr"            = "upload.wikimedia.org/wikipedia/commons/e/ef/2009-2010_Nissan_GT-R_%28R35%29_coupe_01.jpg"
  "ford-mustang"          = "upload.wikimedia.org/wikipedia/commons/9/9c/Ford_Mustang_VII_GT_Rutesheimer_Autoschau_2025_DSC_9234.jpg"
  "chevrolet-corvette"    = "upload.wikimedia.org/wikipedia/commons/4/4b/Chevrolet_Corvette_C8_IAA_2021_1X7A0156.jpg"
  "toyota-supra"          = "upload.wikimedia.org/wikipedia/commons/e/e5/2020_Toyota_GR_Supra_%28United_States%29.png"
  "subaru-wrx"            = "upload.wikimedia.org/wikipedia/commons/d/d0/2022_Subaru_WRX_Sport-Tech_in_World_Rally_Blue_Pearl%2C_Front_Left%2C_06-03-2022.jpg"
  "mitsubishi-evo"        = "upload.wikimedia.org/wikipedia/commons/9/91/2017-04-02_Mitsubishi_Lancer_Evolution_X_MR_SST_14_%282%29.jpg"
  "bmw-m3"                = "upload.wikimedia.org/wikipedia/commons/8/8a/BMW_M3_Competition_%28G80%29_IMG_4041.jpg"
  "aston-martin-db11"     = "upload.wikimedia.org/wikipedia/commons/9/92/2018_Aston_Martin_DB11_V8_Automatic_4.0_Front.jpg"
  "alfa-giulia"           = "upload.wikimedia.org/wikipedia/commons/2/29/Alfa_952_26.06.19_JM_%281%29_%28cropped%29.jpg"
  "alpine-a110"           = "upload.wikimedia.org/wikipedia/commons/8/8f/Alpine_A110_S_Automesse_Ludwigsburg_2022_1X7A5946.jpg"
  "dodge-challenger"      = "upload.wikimedia.org/wikipedia/commons/d/d3/Dodge_Challenger_SRT8_%282015%29_Hirschaid-20220709-RM-120221_%28cropped%29.jpg"
  "chevrolet-camaro"      = "upload.wikimedia.org/wikipedia/commons/5/5e/2019_Chevrolet_Camaro_2SS_6.2L_front_3.16.19.jpg"

  # ---- 豪华轿车 ----
  "mercedes-sclass"       = "upload.wikimedia.org/wikipedia/commons/5/55/Mercedes-Benz_W223_IMG_6663.jpg"
  "rolls-royce-phantom"   = "upload.wikimedia.org/wikipedia/commons/1/1c/2019_Rolls-Royce_Phantom_V12_Automatic_6.75.jpg"
  "bentley-continental"   = "upload.wikimedia.org/wikipedia/commons/e/e1/Bentley_Continental_GT_First_Edition_%2849919050697%29_%28cropped%29_%28cropped%29.jpg"
  "hongqi-h9"             = "upload.wikimedia.org/wikipedia/commons/8/88/Hongqi_H9_010.jpg"

  # ---- 电动车 ----
  "tesla-model-s"         = "upload.wikimedia.org/wikipedia/commons/9/9e/Tesla_Model_S_%28Facelift_ab_04-2016%29_%28cropped%29.jpg"
  "byd-han"               = "upload.wikimedia.org/wikipedia/commons/a/ab/2023_BYD_Han_DM-i_%28facelift%29%2C_front_8.17.23.jpg"
  "porsche-taycan"        = "upload.wikimedia.org/wikipedia/commons/d/dc/2020_Porsche_Taycan_4S_79kWh_Front.jpg"
  "xiaomi-su7"            = "upload.wikimedia.org/wikipedia/commons/f/fc/%28CHN-Shanghai%29_Private_Xiaomi_SU7_%E6%B2%AAA7WE106_2024-11-24.jpg"
  "nio-et7"               = "upload.wikimedia.org/wikipedia/commons/7/70/NIO_ET7_1X7A6679_%28cropped%29.jpg"
  "xpeng-p7"              = "upload.wikimedia.org/wikipedia/commons/0/06/XPeng_P7_II_MY2025_IMG03.jpg"
  "zeekr-001"             = "upload.wikimedia.org/wikipedia/commons/0/0a/2022_Zeekr_001_%28front%29.jpg"
  "wuling-mini-ev"        = "upload.wikimedia.org/wikipedia/commons/1/1a/2022_Wuling_Hongguang_Mini_EV_GameBoy_Edition_%28front%29.jpg"
  "hyundai-ioniq5"        = "upload.wikimedia.org/wikipedia/commons/8/85/Hyundai_Ioniq_5_AWD_Techniq-Paket_%E2%80%93_f_31122024.jpg"
  "kia-ev6"               = "upload.wikimedia.org/wikipedia/commons/d/d9/2021_Kia_EV6_GT-Line_S.jpg"

  # ---- SUV ----
  "bmw-x5"                = "upload.wikimedia.org/wikipedia/commons/f/f1/2019_BMW_X5_M50d_Automatic_3.0.jpg"
  "range-rover"           = "upload.wikimedia.org/wikipedia/commons/1/17/2022_Land_Rover_Range_Rover_SE_P440e_AWD_Automatic_3.0_Front.jpg"
  "volvo-xc90"            = "upload.wikimedia.org/wikipedia/commons/2/23/Volvo_XC90_T8_AWD_Plug-in_Hybrid_Plus_%28II%2C_2._Facelift%29_%E2%80%93_f_03102025.jpg"
  "liauto-l9"             = "upload.wikimedia.org/wikipedia/commons/b/b6/Li_Auto_L9_IMG001.jpg"
  "yangwang-u8"           = "upload.wikimedia.org/wikipedia/commons/1/1a/2024_Yangwang_U8_%28front%29.jpg"

  # ---- 越野 ----
  "landrover-defender"    = "upload.wikimedia.org/wikipedia/commons/4/41/2015_Land_Rover_Defender_%28L316_MY15%29_90_3-door_wagon_%282015-10-24%29_01.jpg"
  "jeep-wrangler"         = "upload.wikimedia.org/wikipedia/commons/b/b9/2018_Jeep_Wrangler_Sahara_Unlimited_Multijet_2.1_Front.jpg"
  "toyota-landcruiser"    = "upload.wikimedia.org/wikipedia/commons/6/6d/2021_Toyota_Land_Cruiser_300_3.4_ZX_%28Colombia%29_front_view_04.png"
  "mercedes-gclass"       = "upload.wikimedia.org/wikipedia/commons/3/38/Mercedes-Benz_W463_G_350_BlueTEC_01.jpg"
  "suzuki-jimny"          = "upload.wikimedia.org/wikipedia/commons/1/13/2019_Suzuki_Jimny_SZ5_4X4_Automatic_1.5.jpg"
  "tank-300"              = "upload.wikimedia.org/wikipedia/commons/e/e9/TANK_300_IMG006.jpg"

  # ---- 家用轿车 ----
  "toyota-corolla"        = "upload.wikimedia.org/wikipedia/commons/f/fe/Toyota_Corolla_Hybrid_%28E210%29_IMG_4338.jpg"
  "vw-golf"               = "upload.wikimedia.org/wikipedia/commons/8/8a/2020_Volkswagen_Golf_Style_1.5_Front.jpg"
  "mini-cooper"           = "upload.wikimedia.org/wikipedia/commons/c/c4/Mini_Hatch_%28J01%29_Ditzingen_Mobil_IMG_9772_%28cropped%29.jpg"
  "honda-civic"           = "upload.wikimedia.org/wikipedia/commons/7/71/2024_Honda_Civic_Type_R%2C_front_right%2C_06-15-2024.jpg"

  # ---- 经典老爷车 ----
  "citroen-ds"            = "upload.wikimedia.org/wikipedia/commons/f/f5/Bornholm_Rundt_2012_%282012-07-08%29%2C_by_Klugschnacker_modified.jpg"
  "vw-beetle"             = "upload.wikimedia.org/wikipedia/commons/9/96/VW_K%C3%A4fer_Baujahr_1966.jpg"
  "ford-model-t"          = "upload.wikimedia.org/wikipedia/commons/1/12/1925_Ford_Model_T_touring.jpg"
  "jaguar-etype"          = "upload.wikimedia.org/wikipedia/commons/6/6d/Jaguar_E-Type_Series_1_3.8_Litre_1961.jpg"
  "fiat-500"              = "upload.wikimedia.org/wikipedia/commons/a/a1/1970_Fiat_500_L_--_2011_DC_1.jpg"
  "vw-t1"                 = "upload.wikimedia.org/wikipedia/commons/9/9b/0385_Porsche_Diesel_Bus_blau.jpg"

  # ---- 皮卡 ----
  "ford-f150"             = "upload.wikimedia.org/wikipedia/commons/f/f0/2018_Ford_F-150_XLT_Crew_Cab%2C_front_11.10.19.jpg"
  "toyota-hilux"          = "upload.wikimedia.org/wikipedia/commons/1/1b/2016_Toyota_HiLux_Invincible_D-4D_4WD_2.4_Front.jpg"

  # ---- 卡车 / 工程车 / 巴士 ----
  "volvo-fh"              = "upload.wikimedia.org/wikipedia/commons/8/88/2013_Volvo_FH16_540_demotruck.jpg"
  "rosenbauer-panther"    = "upload.wikimedia.org/wikipedia/commons/8/8d/Rosenbauer_PANTHER_6x6.jpg"
  "cat-797"               = "orig:upload.wikimedia.org/wikipedia/commons/b/bc/Caterpillar-797-haul-truck-the-big-mining-truck.jpg"
  "liebherr-t282"         = "orig:upload.wikimedia.org/wikipedia/commons/0/0c/Liebherr_t282_1.jpg"
  "routemaster"           = "orig:upload.wikimedia.org/wikipedia/commons/9/9d/RM8_AEC_Routemaster.jpg"

  # ---- 赛车 ----
  "redbull-rb19"          = "upload.wikimedia.org/wikipedia/commons/7/79/FIA_F1_Austria_2023_Nr._1_%281%29.jpg"
  "porsche-919"           = "upload.wikimedia.org/wikipedia/commons/6/69/Porsche%2C_IAA_2017%2C_Frankfurt_%281Y7A2248%29.jpg"
}

# 原图直接取会很大（部分超过 10MB），改取 960px 缩略图，代理再压到 900px WebP
function Resolve-Source($path) {
  if ($path.StartsWith("orig:")) { return $path.Substring(5) }
  $file = $path.Substring($path.LastIndexOf("/") + 1)
  return $path.Replace("/commons/", "/commons/thumb/") + "/960px-$file"
}

$ok = 0; $fail = 0; $skip = 0
foreach ($id in $map.Keys) {
  $out = Join-Path $dir "$id.webp"
  if ((Test-Path $out) -and -not $Force) {
    $skip++; continue
  }
  $src = Resolve-Source $map[$id]
  $proxy = "https://images.weserv.nl/?url=$src&w=900&output=webp&q=72"
  $code = curl.exe -s -L -m 60 --retry 2 -o "$out" -w "%{http_code}" $proxy
  $size = if (Test-Path $out) { (Get-Item $out).Length } else { 0 }
  if ($code -eq "200" -and $size -gt 3000) {
    $ok++; Write-Output ("OK   {0,-22} {1,8} bytes" -f $id, $size)
  } else {
    $fail++; if (Test-Path $out) { Remove-Item $out -Force }
    Write-Output ("FAIL {0,-22} code={1} size={2}" -f $id, $code, $size)
  }
}
Write-Output ("=== DONE: {0} ok, {1} failed, {2} skipped ===" -f $ok, $fail, $skip)
