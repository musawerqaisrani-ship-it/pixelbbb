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

    /**
     * Main Canvas Render Engine
     */
    function renderCanvas() {
        const textValue = urduText.value;
        const fontName = fontFamily.value;
        const sizePx = parseInt(fontSize.value, 10) || 36;
        const lhMult = parseFloat(lineHeight.value);
        const widthPx = parseInt(canvasWidth.value, 10);
        const padPx = parseInt(canvasPadding.value, 10);
        const strWidth = parseInt(strokeWidth.value, 10);
        const shBlur = parseInt(shadowBlur.value, 10);

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

        // Configure Font Specification
        const fontStyle = isItalic.checked ? 'italic ' : '';
        const fontWeight = isBold.checked ? 'bold ' : '';
        const fontSpec = `${fontStyle}${fontWeight}${sizePx}px "${fontName}", "Noto Nastaliq Urdu", sans-serif`;

        ctx.font = fontSpec;

        // Calculate Maximum Width Available for Text Content
        const maxContentWidth = Math.max(100, widthPx - (padPx * 2));
        const wrappedLines = getWrappedLines(ctx, textValue, maxContentWidth);

        // Auto-Expanding Canvas Height Calculation (Bounded up to 20,000px height)
        const lineSpacingPx = sizePx * lhMult;
        const totalContentHeight = (wrappedLines.length * lineSpacingPx) + (padPx * 2);
        
        // Strict boundary cap at 20,000px
        const calculatedHeight = Math.min(20000, Math.max(200, Math.ceil(totalContentHeight)));

        // Update Canvas Resizing Metrics
        canvas.width = widthPx;
        canvas.height = calculatedHeight;
        canvas.style.maxWidth = '100%';
        canvas.style.height = 'auto';

        // Update Toolbar Metrics Display
        dimensionDisplay.textContent = `${widthPx} x ${calculatedHeight} px`;
        lineCountDisplay.textContent = `Lines: ${wrappedLines.length}`;

        // Re-apply Context State Post Resizing
        ctx.font = fontSpec;
        ctx.direction = activeDir;
        ctx.textBaseline = 'alphabetic';

        // 1. Render Background
        if (bgMode.value === 'solid') {
            ctx.fillStyle = bgColor.value;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else if (bgMode.value === 'gradient') {
            const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
            grad.addColorStop(0, bgColor.value);
            grad.addColorStop(1, adjustColorBrightness(bgColor.value, -30));
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
            // Transparent Mode
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        // 2. Resolve Text Alignment & X Coordinates Mapping
        let resolvedAlign = currentAlign;
        if (resolvedAlign === 'auto') {
            resolvedAlign = (activeDir === 'rtl') ? 'right' : 'left';
        }

        let startX;
        if (resolvedAlign === 'right') {
            startX = widthPx - padPx;
            ctx.textAlign = 'right';
        } else if (resolvedAlign === 'center') {
            startX = widthPx / 2;
            ctx.textAlign = 'center';
        } else {
            // Left alignment
            startX = padPx;
            ctx.textAlign = 'left';
        }

        // 3. Render Text Lines with Stroke & Shadow Effects
        wrappedLines.forEach((line, index) => {
            const baselineY = padPx + (index * lineSpacingPx) + (sizePx * 0.85);

            // Configure Text Shadow
            if (shBlur > 0) {
                ctx.shadowColor = shadowColor.value;
                ctx.shadowBlur = shBlur;
                ctx.shadowOffsetX = 3;
                ctx.shadowOffsetY = 3;
            } else {
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
            }

            // Configure Text Stroke
            if (strWidth > 0) {
                ctx.strokeStyle = strokeColor.value;
                ctx.lineWidth = strWidth * 2;
                ctx.lineJoin = 'round';
                ctx.miterLimit = 2;
                ctx.strokeText(line, startX, baselineY);
            }

            // Fill Primary Text
            ctx.fillStyle = textColor.value;
            ctx.fillText(line, startX, baselineY);
        });

        statusText.textContent = `Ready (${wrappedLines.length} lines, ${calculatedHeight}px height, ${activeDir.toUpperCase()})`;
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

    let currentBlobUrl = null;

    /**
     * Clean up active Blob URL to release memory on high-resolution canvases
     */
    function cleanupBlobUrl() {
        if (currentBlobUrl) {
            URL.revokeObjectURL(currentBlobUrl);
            currentBlobUrl = null;
        }
    }

    /**
     * Open Mobile Preview Modal for Long-Press Save Fallback
     * @param {string} blobUrl 
     */
    function openDownloadModal(blobUrl) {
        if (!downloadModal || !modalPreviewImg) return;
        modalPreviewImg.src = blobUrl;
        downloadModal.style.display = 'flex';
        // Force reflow for CSS transition
        downloadModal.offsetHeight;
        downloadModal.classList.add('active');
        downloadModal.setAttribute('aria-hidden', 'false');
    }

    /**
     * Close Mobile Preview Modal and Revoke Blob URL
     */
    function closeDownloadModal() {
        if (!downloadModal) return;
        downloadModal.classList.remove('active');
        downloadModal.setAttribute('aria-hidden', 'true');
        setTimeout(() => {
            downloadModal.style.display = 'none';
            if (modalPreviewImg) modalPreviewImg.src = '';
            cleanupBlobUrl();
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
            if (currentBlobUrl) {
                const newWin = window.open(currentBlobUrl, '_blank');
                if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
                    statusText.textContent = 'Pop-up blocked. Touch & hold image to save.';
                }
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

            // Revoke any previous Blob URL before creating a new one
            cleanupBlobUrl();

            // Create object URL from binary Blob
            currentBlobUrl = URL.createObjectURL(blob);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `text-image-export-${timestamp}.png`;

            const isMobile = isMobileDevice();

            // 1. Cross-Platform Anchor Download Trigger
            const link = document.createElement('a');
            link.download = filename;
            link.href = currentBlobUrl;
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

            // 2. Mobile Fallback (iOS Safari / Android Chrome / WebViews)
            // Show preview modal overlay allowing long-press to save directly to Gallery / Photos
            if (isMobile) {
                openDownloadModal(currentBlobUrl);
                statusText.textContent = 'Ready - Touch & hold preview image to save to Photos';
            } else {
                // Desktop: Schedule Blob URL cleanup after 10s delay to allow download stream to complete
                const blobToRevoke = currentBlobUrl;
                setTimeout(() => {
                    if (currentBlobUrl === blobToRevoke) {
                        cleanupBlobUrl();
                    } else {
                        URL.revokeObjectURL(blobToRevoke);
                    }
                }, 10000);

                statusText.textContent = downloadTriggered ? 'Image download started.' : 'Ready';
            }

        }, 'image/png', 1.0);
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

    // Initial Font Load Triggers
    if (document.fonts) {
        document.fonts.ready.then(() => {
            renderCanvas();
        });
    } else {
        setTimeout(renderCanvas, 300);
    }
});
