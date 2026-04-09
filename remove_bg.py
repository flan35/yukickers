from PIL import Image, ImageOps, ImageFilter

def remove_background(input_path, output_path):
    # Open image and convert to RGBA
    img = Image.open(input_path).convert("RGBA")
    
    # Create a grayscale mask of the character
    # We find the character by using a high-contrast version of the image
    # and using flood fill on the background areas.
    
    # 1. Grayscale version for processing
    gray = img.convert("L").filter(ImageFilter.SHARPEN)
    
    # 2. Threshold to separate dark lines from paper/white bits
    # Since we have black outlines, we can detect them easily.
    # But wait, the checkerboard is also grays.
    
    # Let's try to detect the character's boundary using the black outline.
    # We use a flood fill that stops at 'dark' pixels.
    width, height = img.size
    mask = Image.new("L", (width, height), 255) # Start with all 'keep'
    
    # We process pixels to identify the character
    pixels = img.load()
    mask_pixels = mask.load()
    
    # Flood-fill from corners using a color distance threshold
    # We stop when we hit a pixel that is significantly different from gray/white
    # or when we hit the black outline (low RGB values)
    
    stack = [(0, 0), (width-1, 0), (0, height-1), (width-1, height-1)]
    visited = set()
    
    while stack:
        x, y = stack.pop()
        if (x, y) in visited: continue
        visited.add((x, y))
        
        if x < 0 or x >= width or y < 0 or y >= height: continue
        
        r, g, b, a = pixels[x, y]
        
        # Condition to be 'background':
        # - Light gray/white (checkerboard Colors)
        # - High RGB values (e.g., all > 150)
        # - Not a dark outline (at least one of r,g,b > 100)
        
        is_background = (r > 120 and g > 120 and b > 120) 
        # But wait, the hoodie is white.
        # We need to distinguish hoodie-white from background-white.
        # Background is ALWAYS at the outer edges.
        
        # Let's just use the flood fill strategy from corners but only allowing 'light' pixels.
        if is_background:
            mask_pixels[x, y] = 0 # Mark as transparent
            # Add neighbors
            for dx, dy in [(1,0),(-1,0),(0,1),(0,-1)]:
                nx, ny = x + dx, y + dy
                if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in visited:
                    stack.append((nx, ny))
                    
    # Now create the new image
    new_img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    for y in range(height):
        for x in range(width):
            if mask_pixels[x, y] == 255:
                new_img.putpixel((x, y), pixels[x, y])
            else:
                new_img.putpixel((x, y), (0, 0, 0, 0))
                
    new_img.save(output_path, "PNG")

if __name__ == "__main__":
    remove_background("chibi_reiko_source.png", "chibi_reiko.png")
