from PIL import Image, ImageDraw
import os

def refine_transparency(input_path, output_path, target_pink=(255, 187, 212), threshold=50):
    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found")
        return
        
    img = Image.open(input_path).convert("RGBA")
    width, height = img.size
    
    # Floodfill from the corners to remove the connected pink background
    # This prevents removing white/pink bits inside the character (like eyes or mouth)
    # Target color in the floodfill is transparent (0, 0, 0, 0)
    
    # Seeds for corner points
    seeds = [(0, 0), (width-1, 0), (0, height-1), (width-1, height-1)]
    
    # We use a copy to perform floodfill
    for x, y in seeds:
        # Thresholded floodfill is available in ImageDraw
        ImageDraw.floodfill(img, (x, y), (0, 0, 0, 0), thresh=threshold)

    img.save(output_path, "PNG")
    print(f"Refined transparent result saved to {output_path}")

if __name__ == "__main__":
    # Source image from the conversation
    input_file = r"C:\Users\nswof\.gemini\antigravity\brain\1a2ffeb6-422d-4179-8c2f-d6d814dab122\.tempmediaStorage\media_1a2ffeb6-422d-4179-8c2f-d6d814dab122_1775739243716.png"
    output_file = r"c:\Users\nswof\OneDrive\デスクトップ\yukickers\chibi_admin_yukickers.png"
    refine_transparency(input_file, output_file)
