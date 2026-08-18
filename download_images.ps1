# 通过 images.weserv.nl 代理下载 Wikimedia 车图到本地 images/ 目录
# （Wikimedia 在国内被墙，用境外代理中转下载，运行后即可完全离线显示）

$dir = Join-Path $PSScriptRoot "images"
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }

# id -> Wikimedia 原图路径（不含 https:// 前缀，交给代理拼接）
$map = [ordered]@{
  "bugatti-chiron"        = "upload.wikimedia.org/wikipedia/commons/thumb/1/18/Bugatti_Chiron_1.jpg/960px-Bugatti_Chiron_1.jpg"
  "ferrari-f8"            = "upload.wikimedia.org/wikipedia/commons/thumb/f/f2/2020_Ferrari_F8_Tributo_3.9.jpg/960px-2020_Ferrari_F8_Tributo_3.9.jpg"
  "lamborghini-aventador" = "upload.wikimedia.org/wikipedia/commons/thumb/e/ed/Lamborghini_Aventador_S_%2844554%29.jpg/960px-Lamborghini_Aventador_S_%2844554%29.jpg"
  "porsche-911"           = "upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Porsche_911_No_1000000%2C_70_Years_Porsche_Sports_Car%2C_Berlin_%281X7A3888%29.jpg/960px-Porsche_911_No_1000000%2C_70_Years_Porsche_Sports_Car%2C_Berlin_%281X7A3888%29.jpg"
  "mazda-mx5"             = "upload.wikimedia.org/wikipedia/commons/thumb/9/95/Mazda_Roadster_%28MX-5%29_by_Negawa_Bridge_%28cropped%29.jpg/960px-Mazda_Roadster_%28MX-5%29_by_Negawa_Bridge_%28cropped%29.jpg"
  "nissan-gtr"            = "upload.wikimedia.org/wikipedia/commons/thumb/e/ef/2009-2010_Nissan_GT-R_%28R35%29_coupe_01.jpg/960px-2009-2010_Nissan_GT-R_%28R35%29_coupe_01.jpg"
  "toyota-corolla"        = "upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Toyota_Corolla_Hybrid_%28E210%29_IMG_4338.jpg/960px-Toyota_Corolla_Hybrid_%28E210%29_IMG_4338.jpg"
  "vw-golf"               = "upload.wikimedia.org/wikipedia/commons/thumb/8/8a/2020_Volkswagen_Golf_Style_1.5_Front.jpg/960px-2020_Volkswagen_Golf_Style_1.5_Front.jpg"
  "mercedes-sclass"       = "upload.wikimedia.org/wikipedia/commons/thumb/5/55/Mercedes-Benz_W223_IMG_6663.jpg/960px-Mercedes-Benz_W223_IMG_6663.jpg"
  "rolls-royce-phantom"   = "upload.wikimedia.org/wikipedia/commons/thumb/1/1c/2019_Rolls-Royce_Phantom_V12_Automatic_6.75.jpg/960px-2019_Rolls-Royce_Phantom_V12_Automatic_6.75.jpg"
  "bentley-continental"   = "upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Bentley_Continental_GT_First_Edition_%2849919050697%29_%28cropped%29_%28cropped%29.jpg/960px-Bentley_Continental_GT_First_Edition_%2849919050697%29_%28cropped%29_%28cropped%29.jpg"
  "tesla-model-s"         = "upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Tesla_Model_S_%28Facelift_ab_04-2016%29_%28cropped%29.jpg/960px-Tesla_Model_S_%28Facelift_ab_04-2016%29_%28cropped%29.jpg"
  "byd-han"               = "upload.wikimedia.org/wikipedia/commons/thumb/a/ab/2023_BYD_Han_DM-i_%28facelift%29%2C_front_8.17.23.jpg/960px-2023_BYD_Han_DM-i_%28facelift%29%2C_front_8.17.23.jpg"
  "porsche-taycan"        = "upload.wikimedia.org/wikipedia/commons/thumb/d/dc/2020_Porsche_Taycan_4S_79kWh_Front.jpg/960px-2020_Porsche_Taycan_4S_79kWh_Front.jpg"
  "landrover-defender"    = "upload.wikimedia.org/wikipedia/commons/thumb/4/41/2015_Land_Rover_Defender_%28L316_MY15%29_90_3-door_wagon_%282015-10-24%29_01.jpg/960px-2015_Land_Rover_Defender_%28L316_MY15%29_90_3-door_wagon_%282015-10-24%29_01.jpg"
  "jeep-wrangler"         = "upload.wikimedia.org/wikipedia/commons/thumb/b/b9/2018_Jeep_Wrangler_Sahara_Unlimited_Multijet_2.1_Front.jpg/960px-2018_Jeep_Wrangler_Sahara_Unlimited_Multijet_2.1_Front.jpg"
  "toyota-landcruiser"    = "upload.wikimedia.org/wikipedia/commons/thumb/6/6d/2021_Toyota_Land_Cruiser_300_3.4_ZX_%28Colombia%29_front_view_04.png/960px-2021_Toyota_Land_Cruiser_300_3.4_ZX_%28Colombia%29_front_view_04.png"
  "bmw-x5"                = "upload.wikimedia.org/wikipedia/commons/thumb/f/f1/2019_BMW_X5_M50d_Automatic_3.0.jpg/960px-2019_BMW_X5_M50d_Automatic_3.0.jpg"
  "range-rover"           = "upload.wikimedia.org/wikipedia/commons/thumb/1/17/2022_Land_Rover_Range_Rover_SE_P440e_AWD_Automatic_3.0_Front.jpg/960px-2022_Land_Rover_Range_Rover_SE_P440e_AWD_Automatic_3.0_Front.jpg"
  "ford-mustang"          = "upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Ford_Mustang_VII_GT_Rutesheimer_Autoschau_2025_DSC_9234.jpg/960px-Ford_Mustang_VII_GT_Rutesheimer_Autoschau_2025_DSC_9234.jpg"
  "chevrolet-corvette"    = "upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Chevrolet_Corvette_C8_IAA_2021_1X7A0156.jpg/960px-Chevrolet_Corvette_C8_IAA_2021_1X7A0156.jpg"
  "koenigsegg-jesko"      = "upload.wikimedia.org/wikipedia/commons/thumb/9/9f/GIMS_2019%2C_Le_Grand-Saconnex_%28GIMS0833%29.jpg/960px-GIMS_2019%2C_Le_Grand-Saconnex_%28GIMS0833%29.jpg"
  "volvo-xc90"            = "upload.wikimedia.org/wikipedia/commons/thumb/2/23/Volvo_XC90_T8_AWD_Plug-in_Hybrid_Plus_%28II%2C_2._Facelift%29_%E2%80%93_f_03102025.jpg/960px-Volvo_XC90_T8_AWD_Plug-in_Hybrid_Plus_%28II%2C_2._Facelift%29_%E2%80%93_f_03102025.jpg"
  "citroen-ds"            = "upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Bornholm_Rundt_2012_%282012-07-08%29%2C_by_Klugschnacker_modified.jpg/960px-Bornholm_Rundt_2012_%282012-07-08%29%2C_by_Klugschnacker_modified.jpg"
  "vw-beetle"             = "upload.wikimedia.org/wikipedia/commons/thumb/9/96/VW_K%C3%A4fer_Baujahr_1966.jpg/960px-VW_K%C3%A4fer_Baujahr_1966.jpg"
  "mini-cooper"           = "upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Mini_Hatch_%28J01%29_Ditzingen_Mobil_IMG_9772_%28cropped%29.jpg/960px-Mini_Hatch_%28J01%29_Ditzingen_Mobil_IMG_9772_%28cropped%29.jpg"
  "honda-civic"           = "upload.wikimedia.org/wikipedia/commons/thumb/7/71/2024_Honda_Civic_Type_R%2C_front_right%2C_06-15-2024.jpg/960px-2024_Honda_Civic_Type_R%2C_front_right%2C_06-15-2024.jpg"
}

$ok = 0; $fail = 0
foreach ($id in $map.Keys) {
  $src = $map[$id]
  $proxy = "https://images.weserv.nl/?url=$src&w=900&output=jpg&q=82"
  $out = Join-Path $dir "$id.jpg"
  $code = curl.exe -s -L -m 40 --retry 2 -o "$out" -w "%{http_code}" $proxy
  $size = if (Test-Path $out) { (Get-Item $out).Length } else { 0 }
  if ($code -eq "200" -and $size -gt 3000) {
    $ok++; Write-Output ("OK   {0,-22} {1,8} bytes" -f $id, $size)
  } else {
    $fail++; if (Test-Path $out) { Remove-Item $out -Force }
    Write-Output ("FAIL {0,-22} code={1} size={2}" -f $id, $code, $size)
  }
}
Write-Output ("=== DONE: {0} ok, {1} failed ===" -f $ok, $fail)
