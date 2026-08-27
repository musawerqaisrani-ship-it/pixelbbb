/**
 * Text to Image Canvas Generator - PixelLab
 * HTML5 Canvas Rendering Engine with Simplified Font Handling (Local TTF + Google Web Font)
 */

document.addEventListener('DOMContentLoaded', () => {
    // Canvas Elements
    const canvas = document.getElementById('urduCanvas');
    const ctx = canvas.getContext('2d');

    // UI Input Controls
    const textDirection = document.getElementById('textDirection');
    const urduText = document.getElementById('urduText');
    const fontFamily = document.getElementById('fontFamily');
    const fontSize = document.getElementById('fontSize');
    const fontSizeRange = document.getElementById('fontSizeRange');
    const presetBtns = document.querySelectorAll('.preset-btn');
    const lineHeight = document.getElementById('lineHeight');
    const lineHeightVal = document.getElementById('lineHeightVal');
    const canvasWidth = document.getElementById('canvasWidth');
    const canvasWidthVal = document.getElementById('canvasWidthVal');
    const canvasPadding = document.getElementById('canvasPadding');
    const canvasPaddingVal = document.getElementById('canvasPaddingVal');
    
    // PixelLab Colors & Effects Controls
    const textColor = document.getElementById('textColor');
    const bgColor = document.getElementById('bgColor');
    const bgMode = document.getElementById('bgMode');
    const strokeColor = document.getElementById('strokeColor');
    const strokeWidth = document.getElementById('strokeWidth');
    const strokeWidthVal = document.getElementById('strokeWidthVal');
    const shadowColor = document.getElementById('shadowColor');
    const shadowBlur = document.getElementById('shadowBlur');
    const shadowBlurVal = document.getElementById('shadowBlurVal');

    // Formatting & Alignment Controls
    const isBold = document.getElementById('isBold');
    const isItalic = document.getElementById('isItalic');
    const alignButtons = document.querySelectorAll('.btn-group-item');
    let currentAlign = 'auto'; // 'auto', 'left', 'center', 'right'

    // Buttons & Info Displays
    const btnGenerate = document.getElementById('btnGenerate');
    const btnDownload = document.getElementById('btnDownload');
    const btnDownloadCapCut = document.getElementById('btnDownloadCapCut');
    const dimensionDisplay = document.getElementById('dimensionDisplay');
    const lineCountDisplay = document.getElementById('lineCountDisplay');
    const statusText = document.getElementById('statusText');

    // Debounce Timer State
    let debounceTimeout = null;

    /**
     * Detect Text Direction (RTL vs LTR) based on Unicode range of first non-whitespace character
     * @param {string} text 
     * @returns {'rtl' | 'ltr'}
     */
    function detectTextDirection(text) {
        if (!text) return 'ltr';
        const match = text.match(/\S/);
        if (!match) return 'ltr';
        const charCode = match[0].charCodeAt(0);

        // Arabic / Urdu Unicode Blocks
        if (
            (charCode >= 0x0600 && charCode <= 0x06FF) ||
            (charCode >= 0x0750 && charCode <= 0x077F) ||
            (charCode >= 0x08A0 && charCode <= 0x08FF) ||
            (charCode >= 0xFB50 && charCode <= 0xFDFF) ||
            (charCode >= 0xFE70 && charCode <= 0xFEFF)
        ) {
            return 'rtl';
        }
        return 'ltr';
    }

    /**
     * Debounced Render Trigger (~150ms delay for high-volume text typing)
     */
    function debouncedRenderCanvas(delay = 150) {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            renderCanvas();
        }, delay);
    }

    // Alignment Switcher
    alignButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            alignButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentAlign = btn.dataset.align;
            renderCanvas();
        });
    });

    // Preset Size Buttons
    function updateActivePresetBtn(sizeVal) {
        presetBtns.forEach(btn => {
            if (btn.dataset.size === String(sizeVal)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const size = btn.dataset.size;
            fontSize.value = size;
            if (fontSizeRange) fontSizeRange.value = size;
            updateActivePresetBtn(size);
            renderCanvas();
        });
    });

    // Synchronize Numeric Font Size Input & Range Slider
    if (fontSize && fontSizeRange) {
        fontSize.addEventListener('input', () => {
            const val = parseInt(fontSize.value, 10) || 36;
            fontSizeRange.value = Math.min(200, Math.max(8, val));
            updateActivePresetBtn(val);
            renderCanvas();
        });

        fontSizeRange.addEventListener('input', () => {
            fontSize.value = fontSizeRange.value;
            updateActivePresetBtn(fontSizeRange.value);
            renderCanvas();
        });
    }

    /**
     * Measure and Wrap Multi-Line Paragraph Text for HTML5 Canvas
     * Supports both English (LTR) and Urdu (RTL) word wrapping accurately
     * @param {CanvasRenderingContext2D} context 
     * @param {string} rawText 
     * @param {number} maxWidth 
     * @returns {string[]} Array of wrapped lines
     */
    function getWrappedLines(context, rawText, maxWidth) {
        if (!rawText) return [''];
        const paragraphs = rawText.split(/\r?\n/);
        const wrappedLines = [];

        paragraphs.forEach(paragraph => {
            if (paragraph.trim() === '') {
                wrappedLines.push('');
                return;
            }

            const words = paragraph.split(/\s+/);
            let currentLine = '';

            for (let i = 0; i < words.length; i++) {
                const word = words[i];
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                const metrics = context.measureText(testLine);

                if (metrics.width > maxWidth && currentLine !== '') {
                    wrappedLines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            }
            if (currentLine) {
                wrappedLines.push(currentLine);
            }
        });

        return wrappedLines;
    }

    // SVG Preview Container Element
    const svgPreviewContainer = document.getElementById('svgPreviewContainer');

    /**
     * XML Character Escaping Helper for SVG text nodes
     */
    function escapeXML(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Build SVG string with embedded web fonts, vector styling, and crisp typography rendering
     */
    function generateSVGString({
        textValue,
        fontName,
        sizePx,
        lhMult,
        widthPx,
        padPx,
        strColor,
        strWidth,
        shColor,
        shBlur,
        textColorVal,
        bgColorVal,
        bgModeVal,
        activeDir,
        currentAlign,
        isBold,
        isItalic,
        wrappedLines,
        calculatedHeight
    }) {
        const lineSpacingPx = sizePx * lhMult;

        let resolvedAlign = currentAlign;
        if (resolvedAlign === 'auto') {
            resolvedAlign = (activeDir === 'rtl') ? 'right' : 'left';
        }

        let startX;
        let textAnchor;
        if (resolvedAlign === 'right') {
            startX = widthPx - padPx;
            textAnchor = 'end';
        } else if (resolvedAlign === 'center') {
            startX = widthPx / 2;
            textAnchor = 'middle';
        } else {
            startX = padPx;
            textAnchor = 'start';
        }

        let bgElement = '';
        if (bgModeVal === 'solid') {
            bgElement = `<rect width="100%" height="100%" fill="${bgColorVal}"/>`;
        } else if (bgModeVal === 'gradient') {
            const darkBg = adjustColorBrightness(bgColorVal, -30);
            bgElement = `
    <defs>
      <linearGradient id="svgBgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${bgColorVal}"/>
        <stop offset="100%" stop-color="${darkBg}"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#svgBgGrad)"/>`;
        }

        let filterDef = '';
        let filterAttr = '';
        if (shBlur > 0) {
            filterDef = `
    <filter id="svgTextShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="3" dy="3" stdDeviation="${shBlur / 2}" flood-color="${shColor}" flood-opacity="0.8"/>
    </filter>`;
            filterAttr = `filter="url(#svgTextShadow)"`;
        }

        const fontStyleStr = isItalic ? 'italic' : 'normal';
        const fontWeightStr = isBold ? 'bold' : 'normal';
        const strokeAttr = strWidth > 0 ? `stroke="${strColor}" stroke-width="${strWidth * 2}" stroke-linejoin="round" stroke-miterlimit="2" paint-order="stroke fill"` : '';

        const textLinesSVG = wrappedLines.map((line, index) => {
            const baselineY = padPx + (index * lineSpacingPx) + (sizePx * 0.85);
            return `<text x="${startX}" y="${baselineY}" 
                          font-family="'${fontName}', 'Noto Nastaliq Urdu', sans-serif" 
                          font-size="${sizePx}px" 
                          font-weight="${fontWeightStr}" 
                          font-style="${fontStyleStr}" 
                          fill="${textColorVal}" 
                          text-anchor="${textAnchor}" 
                          direction="${activeDir}" 
                          ${strokeAttr} 
                          ${filterAttr}
                          shape-rendering="geometricPrecision" 
                          text-rendering="optimizeLegibility" 
                          style="-webkit-font-smoothing: antialiased;"
                    >${escapeXML(line)}</text>`;
        }).join('\n    ');

        return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${calculatedHeight}" viewBox="0 0 ${widthPx} ${calculatedHeight}">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap');
      @font-face {
          font-family: 'Jameel Noori Nastaliq';
          src: url('./fonts/JameelNooriNastaliq.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
      }
      text {
          shape-rendering: geometricPrecision;
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
      }
    </style>
    ${filterDef}
  </defs>
  ${bgElement}
  <g class="text-content">
    ${textLinesSVG}
  </g>
</svg>`;
    }

    /**
     * Vector SVG-Based Ultra-Sharp Renderer Engine
     */
    function renderCanvas() {
        const textValue = urduText.value;
        const fontName = fontFamily.value;
        const sizePx = parseInt(fontSize.value, 10) || 36;
        const lhMult = parseFloat(lineHeight.value);
        const widthPx = parseInt(canvasWidth.value, 10) || 2160;
        const padPx = parseInt(canvasPadding.value, 10);
        const strWidth = parseInt(strokeWidth.value, 10);
        const shBlur = parseInt(shadowBlur.value, 10);
        const strColor = strokeColor.value;
        const shColor = shadowColor.value;
        const textColorVal = textColor.value;
        const bgColorVal = bgColor.value;
        const bgModeVal = bgMode.value;

        // Determine Active Direction (Auto vs Explicit)
        const selectedDirSetting = textDirection.value;
        const activeDir = (selectedDirSetting === 'auto') ? detectTextDirection(textValue) : selectedDirSetting;

        // Dynamically update text input direction
        urduText.setAttribute('dir', activeDir);

        // Update UI Label Indicators
        lineHeightVal.textContent = `${lhMult.toFixed(1)}`;
        canvasWidthVal.textContent = `${widthPx}px`;
        canvasPaddingVal.textContent = `${padPx}px`;
        strokeWidthVal.textContent = `${strWidth}px`;
        shadowBlurVal.textContent = `${shBlur}px`;

        // Configure Font Specification for Measurement
        const fontStyle = isItalic.checked ? 'italic ' : '';
        const fontWeight = isBold.checked ? 'bold ' : '';
        const fontSpec = `${fontStyle}${fontWeight}${sizePx}px "${fontName}", "Noto Nastaliq Urdu", sans-serif`;

        ctx.font = fontSpec;

        // Calculate Maximum Width Available for Text Content
        const maxContentWidth = Math.max(100, widthPx - (padPx * 2));
        const wrappedLines = getWrappedLines(ctx, textValue, maxContentWidth);

        // Auto-Expanding Height Calculation (Cap at 20,000px)
        const lineSpacingPx = sizePx * lhMult;
        const totalContentHeight = (wrappedLines.length * lineSpacingPx) + (padPx * 2);
        const calculatedHeight = Math.min(20000, Math.max(200, Math.ceil(totalContentHeight)));

        // Generate Ultra-Sharp Vector SVG Output
        const svgString = generateSVGString({
            textValue,
            fontName,
            sizePx,
            lhMult,
            widthPx,
            padPx,
            strColor,
            strWidth,
            shColor,
            shBlur,
            textColorVal,
            bgColorVal,
            bgModeVal,
            activeDir,
            currentAlign,
            isBold: isBold.checked,
            isItalic: isItalic.checked,
            wrappedLines,
            calculatedHeight
        });

        // 1. Synchronized Vector SVG Live Preview (100% Crisp Vector, Identical to Export)
        if (svgPreviewContainer) {
            svgPreviewContainer.innerHTML = svgString;
        }

        // 2. High-DPI SVG-to-Canvas Conversion (devicePixelRatio = 4 for 8K Ultra HD PNG & CapCut Slicing)
        const deviceScale = window.devicePixelRatio || 4;
        const targetScale = Math.max(4, deviceScale);
        const maxCanvasDim = 16384;
        const scale = Math.max(1, Math.min(targetScale, Math.floor(maxCanvasDim / widthPx), Math.floor(maxCanvasDim / calculatedHeight)));

        const targetBitmapWidth = Math.floor(widthPx * scale);
        const targetBitmapHeight = Math.floor(calculatedHeight * scale);

        canvas.width = targetBitmapWidth;
        canvas.height = targetBitmapHeight;
        canvas.style.width = `${widthPx}px`;
        canvas.style.height = `${calculatedHeight}px`;

        // Bake SVG vector into 4x bitmap on Canvas
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        const img = new Image();

        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, targetBitmapWidth, targetBitmapHeight);
            URL.revokeObjectURL(svgUrl);
            statusText.textContent = `Ready - SVG Vector Synchronized (${wrappedLines.length} lines, ${widthPx}x${calculatedHeight}px @ ${scale}x Ultra HD)`;
        };
        img.onerror = () => {
            URL.revokeObjectURL(svgUrl);
        };
        img.src = svgUrl;

        // Update Toolbar Metrics Display
        dimensionDisplay.textContent = `${widthPx} x ${calculatedHeight} px (${scale}x Vector 8K)`;
        lineCountDisplay.textContent = `Lines: ${wrappedLines.length}`;
    }

    /**
     * Helper to adjust color brightness for background gradients
     */
    function adjustColorBrightness(hex, percent) {
        let num = parseInt(hex.replace('#', ''), 16),
            amt = Math.round(2.55 * percent),
            R = (num >> 16) + amt,
            G = (num >> 8 & 0x00FF) + amt,
            B = (num & 0x0000FF) + amt;
        return '#' + (0x1000000 + (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
            (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
            (B < 255 ? (B < 1 ? 0 : B) : 255)).toString(16).slice(1);
    }

    // Modal & Blob State Tracking
    const downloadModal = document.getElementById('downloadModal');
    const modalPreviewImg = document.getElementById('modalPreviewImg');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalDoneBtn = document.getElementById('modalDoneBtn');
    const btnOpenNewTab = document.getElementById('btnOpenNewTab');

    let activeBlobUrls = [];

    /**
     * Clean up active Blob URLs to release memory on high-resolution canvases
     */
    function cleanupBlobUrls() {
        if (activeBlobUrls.length > 0) {
            activeBlobUrls.forEach(url => URL.revokeObjectURL(url));
            activeBlobUrls = [];
        }
    }

    /**
     * Open Mobile Preview Modal for Long-Press Save Fallback
     * @param {string | Array<{url: string, filename: string}>} items 
     */
    function openDownloadModal(items) {
        if (!downloadModal || !modalPreviewImg) return;
        const itemList = Array.isArray(items) ? items : [{ url: items, filename: 'text-image.png' }];

        modalPreviewImg.src = itemList[0].url;

        let multiWrapper = document.getElementById('modalMultiPreview');
        if (!multiWrapper) {
            multiWrapper = document.createElement('div');
            multiWrapper.id = 'modalMultiPreview';
            modalPreviewImg.parentNode.insertBefore(multiWrapper, modalPreviewImg.nextSibling);
        }
        multiWrapper.innerHTML = '';

        if (itemList.length > 1) {
            modalPreviewImg.style.display = 'none';
            itemList.forEach((item, idx) => {
                const card = document.createElement('div');
                card.style.marginBottom = '14px';
                card.style.textAlign = 'center';

                const title = document.createElement('div');
                title.textContent = `Part ${idx + 1}: ${item.filename}`;
                title.style.fontWeight = '600';
                title.style.fontSize = '0.85rem';
                title.style.marginBottom = '6px';
                title.style.color = '#2563eb';

                const img = document.createElement('img');
                img.src = item.url;
                img.alt = item.filename;
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                img.style.borderRadius = '4px';
                img.style.border = '1px solid #e2e8f0';

                card.appendChild(title);
                card.appendChild(img);
                multiWrapper.appendChild(card);
            });
        } else {
            modalPreviewImg.style.display = 'block';
        }

        downloadModal.style.display = 'flex';
        downloadModal.offsetHeight;
        downloadModal.classList.add('active');
        downloadModal.setAttribute('aria-hidden', 'false');
    }

    /**
     * Close Mobile Preview Modal and Revoke Blob URLs
     */
    function closeDownloadModal() {
        if (!downloadModal) return;
        downloadModal.classList.remove('active');
        downloadModal.setAttribute('aria-hidden', 'true');
        setTimeout(() => {
            downloadModal.style.display = 'none';
            if (modalPreviewImg) modalPreviewImg.src = '';
            const multiWrapper = document.getElementById('modalMultiPreview');
            if (multiWrapper) multiWrapper.innerHTML = '';
            cleanupBlobUrls();
        }, 250);
    }

    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeDownloadModal);
    if (modalDoneBtn) modalDoneBtn.addEventListener('click', closeDownloadModal);
    if (downloadModal) {
        downloadModal.addEventListener('click', (e) => {
            if (e.target === downloadModal) {
                closeDownloadModal();
            }
        });
    }

    if (btnOpenNewTab) {
        btnOpenNewTab.addEventListener('click', () => {
            if (activeBlobUrls.length > 0) {
                activeBlobUrls.forEach(url => {
                    window.open(url, '_blank');
                });
            }
        });
    }

    /**
     * Detect Mobile / iOS Environment
     * @returns {boolean}
     */
    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    /**
     * Download Canvas Image as High-Res PNG File with 100% Mobile Compatibility
     */
    function downloadPNG() {
        if (!canvas) return;

        statusText.textContent = 'Generating image blob...';

        canvas.toBlob((blob) => {
            if (!blob) {
                statusText.textContent = 'Error: Canvas export failed.';
                console.error('Canvas.toBlob returned null.');
                return;
            }

            cleanupBlobUrls();

            const blobUrl = URL.createObjectURL(blob);
            activeBlobUrls.push(blobUrl);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `text-image-export-${timestamp}.png`;
            const isMobile = isMobileDevice();

            const link = document.createElement('a');
            link.download = filename;
            link.href = blobUrl;
            document.body.appendChild(link);

            let downloadTriggered = false;
            try {
                link.click();
                downloadTriggered = true;
            } catch (err) {
                console.warn('Direct anchor click failed or restricted:', err);
                downloadTriggered = false;
            } finally {
                document.body.removeChild(link);
            }

            if (isMobile) {
                openDownloadModal({ url: blobUrl, filename: filename });
                statusText.textContent = 'Ready - Touch & hold preview image to save to Photos';
            } else {
                setTimeout(() => {
                    cleanupBlobUrls();
                }, 10000);

                statusText.textContent = downloadTriggered ? 'Image download started.' : 'Ready';
            }

        }, 'image/png', 1.0);
    }

    /**
     * CapCut Slicing & Export Options
     * Slice ultra-long dynamic text canvas vertically into standard 1080x1920 HD ratio image chunks
     * and trigger batch download for each slice (text-part-1.png, text-part-2.png, etc.).
     */
    function downloadCapCutParts() {
        if (!canvas) return;

        const widthPx = parseInt(canvasWidth.value, 10) || 2160;
        
        // Standard 1080x1920 HD Ratio (16:9 vertical) slice height in logical pixels
        const sliceLogicalWidth = widthPx;
        const sliceLogicalHeight = Math.round(widthPx * (1920 / 1080));

        // Get active High-DPI scale factor (4x Ultra HD 8K Vector Scale)
        const scaleFactor = 4;
        const deviceScale = window.devicePixelRatio || 4;
        const targetScale = Math.max(scaleFactor, deviceScale);
        const maxCanvasDim = 16384;
        const currentScale = Math.max(1, Math.min(targetScale, Math.floor(maxCanvasDim / widthPx), Math.floor(maxCanvasDim / canvas.height)));

        // Internal Bitmap Dimensions (Scaled) vs Slice Bitmap Dimensions
        const bitmapWidth = canvas.width;
        const bitmapHeight = canvas.height;
        const sliceBitmapWidth = bitmapWidth;
        const sliceBitmapHeight = Math.round(sliceLogicalHeight * currentScale);

        // Calculate total slice count
        const numSlices = Math.ceil(bitmapHeight / sliceBitmapHeight);

        statusText.textContent = `Preparing ${numSlices} CapCut split part(s)...`;
        cleanupBlobUrls();

        const isMobile = isMobileDevice();
        const generatedParts = [];
        let currentSlice = 0;

        function processSlice() {
            if (currentSlice >= numSlices) {
                if (isMobile) {
                    openDownloadModal(generatedParts);
                    statusText.textContent = `Ready - ${numSlices} CapCut part(s) available in preview modal`;
                } else {
                    statusText.textContent = `Successfully downloaded ${numSlices} CapCut split part(s).`;
                    setTimeout(() => {
                        cleanupBlobUrls();
                    }, 15000);
                }
                return;
            }

            const sliceIndex = currentSlice;
            const filename = `text-part-${sliceIndex + 1}.png`;

            // Create offscreen canvas for current slice at high-DPI 1080x1920 HD ratio resolution
            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = sliceBitmapWidth;
            sliceCanvas.height = sliceBitmapHeight;

            const sliceCtx = sliceCanvas.getContext('2d');
            sliceCtx.imageSmoothingEnabled = false; // Disable blur-smoothing to keep font pixels razor-sharp
            if ('textRendering' in sliceCtx) {
                sliceCtx.textRendering = 'geometricPrecision';
            }

            // Fill background matching current canvas settings
            if (bgMode.value === 'solid') {
                sliceCtx.fillStyle = bgColor.value;
                sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
            } else if (bgMode.value === 'gradient') {
                const grad = sliceCtx.createLinearGradient(0, 0, 0, sliceCanvas.height);
                grad.addColorStop(0, bgColor.value);
                grad.addColorStop(1, adjustColorBrightness(bgColor.value, -30));
                sliceCtx.fillStyle = grad;
                sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
            } else {
                sliceCtx.clearRect(0, 0, sliceCanvas.width, sliceCanvas.height);
            }

            // Calculate source crop height from main canvas bitmap
            const sy = sliceIndex * sliceBitmapHeight;
            const sh = Math.min(sliceBitmapHeight, bitmapHeight - sy);

            // Draw bitmap slice onto slice canvas
            sliceCtx.drawImage(
                canvas,
                0, sy, sliceBitmapWidth, sh,
                0, 0, sliceBitmapWidth, sh
            );

            // Export slice as high quality PNG blob
            sliceCanvas.toBlob((blob) => {
                if (!blob) {
                    console.error(`Failed to create blob for slice ${sliceIndex + 1}`);
                    currentSlice++;
                    processSlice();
                    return;
                }

                const blobUrl = URL.createObjectURL(blob);
                activeBlobUrls.push(blobUrl);
                generatedParts.push({ url: blobUrl, filename: filename });

                // Trigger batch download on desktop
                if (!isMobile) {
                    const link = document.createElement('a');
                    link.download = filename;
                    link.href = blobUrl;
                    document.body.appendChild(link);
                    try {
                        link.click();
                    } catch (e) {
                        console.warn(`Click failed for ${filename}`, e);
                    } finally {
                        document.body.removeChild(link);
                    }
                }

                statusText.textContent = `Downloaded CapCut part ${sliceIndex + 1} of ${numSlices}...`;
                currentSlice++;

                // Delay slightly (350ms) between downloads to avoid browser throttling
                setTimeout(processSlice, isMobile ? 50 : 350);
            }, 'image/png', 1.0);
        }

        processSlice();
    }

    // Attach Event Listeners for Live Updates
    urduText.addEventListener('input', () => debouncedRenderCanvas(150));
    urduText.addEventListener('change', renderCanvas);

    fontFamily.addEventListener('change', () => {
        renderCanvas();
        if (document.fonts) {
            document.fonts.load(`36px "${fontFamily.value}"`).then(() => {
                renderCanvas();
            }).catch(() => {});
        }
        setTimeout(renderCanvas, 300);
    });

    const directControls = [
        textDirection, fontSize, lineHeight, canvasWidth, canvasPadding,
        textColor, bgColor, bgMode, strokeColor, strokeWidth,
        shadowColor, shadowBlur, isBold, isItalic
    ];

    directControls.forEach(control => {
        if (control) {
            control.addEventListener('input', renderCanvas);
            control.addEventListener('change', renderCanvas);
        }
    });

    btnGenerate.addEventListener('click', renderCanvas);
    btnDownload.addEventListener('click', downloadPNG);
    if (btnDownloadCapCut) {
        btnDownloadCapCut.addEventListener('click', downloadCapCutParts);
    }

    // Initial Font Load Triggers
    if (document.fonts) {
        document.fonts.ready.then(() => {
            renderCanvas();
        });
    } else {
        setTimeout(renderCanvas, 300);
    }
});
