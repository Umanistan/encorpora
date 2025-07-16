import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { useParams } from 'react-router-dom';
import { readFileSrc } from '@/lib/utils';

// Set up the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';


export const BasicPdfRender = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const { bookPath } = useParams<{ bookPath: string }>();


  useEffect(() => {
    if (!bookPath) return;

    const loadPdf = async () => {
      try {
        const pa = await readFileSrc(bookPath)
        setLoading(true);
        setError(null);
        
        const loadingTask = pdfjsLib.getDocument(pa);
        const pdf = await loadingTask.promise;
        
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError('Failed to load PDF file');
      } finally {
        setLoading(false);
      }
    };

    loadPdf();
  }, [bookPath]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    const renderPage = async () => {
      try {
        // Cancel any ongoing render operation
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
          renderTaskRef.current = null;
        }

        const page = await pdfDoc.getPage(currentPage);
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d')!;

        const viewport = page.getViewport({ scale: 1.5 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        // Store the render task so we can cancel it if needed
        renderTaskRef.current = page.render(renderContext);
        await renderTaskRef.current.promise;
        renderTaskRef.current = null;
      } catch (err) {
        // Ignore cancellation errors
        if (err.name !== 'RenderingCancelledException') {
          console.error('Error rendering page:', err);
          setError('Failed to render PDF page');
        }
      }
    };

    renderPage();
  }, [pdfDoc, currentPage]);

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 `}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
          <p>Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center p-8 `}>
        <div className="text-center text-red-600">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center `}>
      <div className="mb-4 flex items-center gap-4">
        <button
          onClick={goToPrevPage}
          disabled={currentPage <= 1}
          className="px-3 py-1 bg-blue-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        
        <span className="text-sm">
          Page {currentPage} of {totalPages}
        </span>
        
        <button
          onClick={goToNextPage}
          disabled={currentPage >= totalPages}
          className="px-3 py-1 bg-blue-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
      
      <div className="border border-gray-300 shadow-lg">
        <canvas ref={canvasRef} className="max-w-full h-auto" />
      </div>
    </div>
  );
};