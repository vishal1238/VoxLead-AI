import { useEffect, useState } from 'react';
import { Upload, FileText, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import { getKnowledgeDocs, uploadKnowledgeFile, deleteKnowledgeDoc } from '../services/api';

export default function KnowledgeBase() {
  const [docs, setDocs] = useState([]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadDocs = async () => {
    try {
      const data = await getKnowledgeDocs();
      setDocs(data.documents || []);
    } catch (err) {
      setError('Failed to fetch knowledge base documents.');
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const res = await uploadKnowledgeFile(file);
      const doc = res.document;
      setSuccess(
        doc.embeddingStatus === 'embedded'
          ? `Uploaded "${doc.filename}" (${doc.chunkCount} chunks embedded via Hugging Face).`
          : `Uploaded "${doc.filename}" (${doc.chunkCount} chunks saved with keyword fallback: ${doc.embeddingError}).`
      );
      setFile(null);
      loadDocs();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteKnowledgeDoc(id);
      loadDocs();
    } catch (err) {
      setError('Failed to delete document.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Company Knowledge Base (Moderate RAG)</h2>
        <p className="text-sm text-slate-400">
          Upload PDF or TXT product docs. Text is chunked, embedded via Hugging Face API, and searched with cosine similarity.
        </p>
      </div>

      {/* Upload Card */}
      <form
        onSubmit={handleUpload}
        className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 flex flex-col sm:flex-row items-center gap-4"
      >
        <label className="flex-1 w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-950 border border-dashed border-slate-700 hover:border-indigo-500 cursor-pointer">
          <Upload className="w-5 h-5 text-indigo-400 shrink-0" />
          <span className="text-sm text-slate-300 truncate">
            {file ? file.name : 'Choose a .pdf or .txt file (max 5MB)...'}
          </span>
          <input
            type="file"
            accept=".pdf,.txt"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
          />
        </label>

        <button
          type="submit"
          disabled={!file || uploading}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-40 cursor-pointer"
        >
          {uploading ? 'Processing & Embedding...' : 'Upload Document'}
        </button>
      </form>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
          {success}
        </div>
      )}

      {/* Documents List */}
      <div className="rounded-2xl bg-slate-900/70 border border-slate-800/80 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-5 py-3.5">Document</th>
              <th className="px-5 py-3.5">Type</th>
              <th className="px-5 py-3.5">Chunks</th>
              <th className="px-5 py-3.5">RAG Indexing Status</th>
              <th className="px-5 py-3.5">Uploaded</th>
              <th className="px-5 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {docs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                  No documents uploaded yet. Upload a product brochure or pricing sheet to enable RAG.
                </td>
              </tr>
            ) : (
              docs.map((doc) => (
                <tr key={doc._id} className="hover:bg-slate-800/40">
                  <td className="px-5 py-3.5 font-medium text-white flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>{doc.filename}</span>
                  </td>
                  <td className="px-5 py-3.5 uppercase text-xs text-slate-400">{doc.fileType}</td>
                  <td className="px-5 py-3.5 text-slate-300">{doc.chunkCount}</td>
                  <td className="px-5 py-3.5">
                    {doc.embeddingStatus === 'embedded' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300">
                        <CheckCircle className="w-3.5 h-3.5" /> Embedded (Cosine)
                      </span>
                    ) : (
                      <span
                        title={doc.embeddingError}
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" /> Keyword Fallback
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-slate-400 text-xs">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => handleDelete(doc._id)}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                      aria-label="Delete Document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
