from PIL import Image
import os

def remove_background(input_path, output_path, target_color=(255, 187, 212), threshold=80):
    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found")
        return
        
    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()

    new_data = []
    for item in datas:
        # Calculate color distance
        dist = sum((a - b) ** 2 for a, b in zip(item[:3], target_color)) ** 0.5
        
        # Also check if it's generally "pinkish/light" if the exact match fails
        # Or just use the distance
        if dist < threshold:
            new_data.append((255, 255, 255, 0)) # Transparent
        else:
            new_data.append(item)

    img.putdata(new_data)
    img.save(output_path, "PNG")
    print(f"Saved transparent image to {output_path}")

if __name__ == "__main__":
    input_file = r"C:\Users\nswof\.gemini\antigravity\brain\1a2ffeb6-422d-4179-8c2f-d6d814dab122\.tempmediaStorage\media_1a2ffeb6-422d-4179-8c2f-d6d814dab122_1775739243716.png"
    output_file = r"c:\Users\nswof\OneDrive\デスクトップ\yukickers\chibi_admin_yukickers.png"
    remove_background(input_file, output_file)
