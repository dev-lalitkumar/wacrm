'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Upload, Trash2, Building2 } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useCompany } from '@/hooks/use-company';
import { canManageCompany } from '@/lib/auth/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

export function CompanyForm() {
  const supabase = createClient();
  const { profile } = useAuth();
  const { company, refresh } = useCompany();
  const canManage = canManageCompany(profile?.role ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [taxId, setTaxId] = useState('');

  const [pendingLogo, setPendingLogo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);

  const [saving, setSaving] = useState(false);

  // Seed once company loads
  useEffect(() => {
    if (!company) return;
    setName(company.name ?? '');
    setWebsite(company.website ?? '');
    setEmail(company.email ?? '');
    setPhone(company.phone ?? '');
    setAddress(company.address ?? '');
    setTaxId(company.tax_id ?? '');
  }, [company]);

  // Cleanup object URLs on unmount or preview swap
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const currentLogo =
    previewUrl ?? (!removeLogo ? company?.logo_url ?? null : null);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_MIME.has(file.type)) {
      toast.error('Unsupported image type', { description: 'Use PNG, JPG, WebP, or GIF.' });
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error('Image is too large', { description: 'Maximum 2 MB.' });
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingLogo(file);
    setPreviewUrl(URL.createObjectURL(file));
    setRemoveLogo(false);
  }

  function onRemoveLogo() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingLogo(null);
    setPreviewUrl(null);
    setRemoveLogo(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Company name is required');
      return;
    }
    setSaving(true);
    try {
      let nextLogoUrl: string | null = company?.logo_url ?? null;

      if (pendingLogo) {
        const ext = pendingLogo.name.split('.').pop()?.toLowerCase() || 'png';
        const path = `logo-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('company-logos')
          .upload(path, pendingLogo, {
            cacheControl: '3600',
            upsert: true,
            contentType: pendingLogo.type,
          });
        if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
        const { data: pub } = supabase.storage.from('company-logos').getPublicUrl(path);
        nextLogoUrl = pub.publicUrl;
      } else if (removeLogo) {
        nextLogoUrl = null;
      }

      const { error } = await supabase
        .from('companies')
        .update({
          name: trimmedName,
          website: website.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          address: address.trim() || null,
          tax_id: taxId.trim() || null,
          logo_url: nextLogoUrl,
          updated_by: profile?.id ?? null,
        })
        .eq('id', 1);

      if (error) throw new Error(`Save failed: ${error.message}`);

      setPendingLogo(null);
      setPreviewUrl(null);
      setRemoveLogo(false);
      await refresh();
      toast.success('Company details saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) {
    return (
      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="py-10 text-center text-sm text-slate-500">
          Only admins and owners can edit company details.
        </CardContent>
      </Card>
    );
  }

  const initial = (name || 'C').charAt(0).toUpperCase();

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Building2 className="size-4 text-primary" />
          Company Details
        </CardTitle>
        <CardDescription className="text-slate-400">
          Branding shown in the sidebar and on customer-facing documents.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5">
          {/* Logo row */}
          <div className="flex items-center gap-4">
            <div className="size-16 shrink-0 rounded-xl border border-slate-700 bg-slate-800 overflow-hidden flex items-center justify-center">
              {currentLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentLogo} alt="Logo" className="size-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-primary">{initial}</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={onPickFile}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="border-slate-700 text-slate-200 hover:bg-slate-800"
              >
                <Upload className="size-4" />
                Upload logo
              </Button>
              {currentLogo && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onRemoveLogo}
                  className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 className="size-4" />
                  Remove
                </Button>
              )}
              <p className="basis-full text-[11px] text-slate-500">
                PNG / JPG / WebP / GIF · max 2 MB
              </p>
            </div>
          </div>

          {/* Name (required) */}
          <div className="space-y-1.5">
            <Label htmlFor="cf-name" className="text-slate-300">
              Company name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="cf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Corp"
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>

          {/* Website + Email + Phone */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cf-website" className="text-slate-300">Website</Label>
              <Input
                id="cf-website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-email" className="text-slate-300">Email</Label>
              <Input
                id="cf-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hello@example.com"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-phone" className="text-slate-300">Phone</Label>
              <Input
                id="cf-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 123 4567"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-tax" className="text-slate-300">Tax ID / GST</Label>
              <Input
                id="cf-tax"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="GSTIN / VAT / EIN"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label htmlFor="cf-address" className="text-slate-300">Address</Label>
            <Textarea
              id="cf-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, City, State, Country"
              className="min-h-[80px] bg-slate-800 border-slate-700 text-white"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
