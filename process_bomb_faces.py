from PIL import Image, ImageOps, ImageEnhance, ImageChops, ImageFilter
import os
from rembg import remove

def create_bomb_face(input_path, output_path, tint_color):
    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found")
        return
    
    # 画像の読み込み
    img = Image.open(input_path).convert("RGBA")
    
    # 背景除去 (rembgを使用)
    print(f"Removing background for {input_path}...")
    no_bg = remove(img)
    
    # 顔部分をクロップ (透明でない部分の境界を取得)
    bbox = no_bg.getbbox()
    if bbox:
        no_bg = no_bg.crop(bbox)
    
    # アスペクト比を保ちつつ、正方形に収める
    width, height = no_bg.size
    size = max(width, height)
    final_canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    # 中央に配置
    offset = ((size - width) // 2, (size - height) // 2)
    final_canvas.paste(no_bg, offset, no_bg)
    
    # 色付け（ペイント）
    # 彩度を落としてから指定色で着色
    gray = ImageOps.grayscale(final_canvas.convert("RGB")).convert("RGBA")
    # アルファチャンネルをコピー
    gray.putalpha(final_canvas.split()[3])
    
    if tint_color == "red":
        # 赤っぽくブレンド
        red_tint = Image.new("RGBA", (size, size), (255, 30, 30, 255))
        final = ImageChops.multiply(gray, red_tint)
        enhancer = ImageEnhance.Contrast(final)
        final = enhancer.enhance(1.4)
    else:
        # 黒・グレー調
        enhancer = ImageEnhance.Brightness(gray)
        final = enhancer.enhance(0.6)
        black_tint = Image.new("RGBA", (size, size), (120, 120, 150, 255))
        final = ImageChops.multiply(final, black_tint)

    # 256x256にリサイズ
    final = final.resize((256, 256), Image.Resampling.LANCZOS)
    
    # 保存
    final.save(output_path, "PNG")
    print(f"Precisely cutout bomb face saved to {output_path}")

if __name__ == "__main__":
    inoshishi_src = r"C:\Users\nswof\.gemini\antigravity\brain\d327e746-e262-4922-bd60-84cfe0425dd0\media__1776484885004.jpg"
    ponchan_src = r"C:\Users\nswof\.gemini\antigravity\brain\d327e746-e262-4922-bd60-84cfe0425dd0\media__1776484886548.jpg"
    
    create_bomb_face(inoshishi_src, "bomb_red.png", "red")
    create_bomb_face(ponchan_src, "bomb_black.png", "black")
