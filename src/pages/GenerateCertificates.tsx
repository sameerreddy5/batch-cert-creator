import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import * as XLSX from 'xlsx';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/Navbar';
import { CertificateTemplate, ExcelData } from '@/types';
import { Upload, FileSpreadsheet, ArrowRight, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

const generateSchema = z.object({
  template_id: z.string().min(1, 'Please select a template'),
  batch_name: z.string().min(1, 'Batch name is required'),
});

type GenerateForm = z.infer<typeof generateSchema>;

export const GenerateCertificates = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<CertificateTemplate | null>(null);
  const [excelData, setExcelData] = useState<ExcelData[]>([]);
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [placeholderMapping, setPlaceholderMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const form = useForm<GenerateForm>({
    resolver: zodResolver(generateSchema),
  });

  const selectedTemplateId = form.watch('template_id');

  useEffect(() => {
    if (user) {
      fetchTemplates();
    }
  }, [user]);

  useEffect(() => {
    if (selectedTemplateId) {
      const template = templates.find(t => t.id === selectedTemplateId);
      setSelectedTemplate(template || null);
      
      // Reset mapping when template changes
      if (template) {
        const newMapping: Record<string, string> = {};
        template.placeholders.forEach(placeholder => {
          newMapping[placeholder] = '';
        });
        setPlaceholderMapping(newMapping);
      }
    }
  }, [selectedTemplateId, templates]);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('certificate_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch templates',
        variant: 'destructive',
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as ExcelData[];

      if (jsonData.length === 0) {
        throw new Error('The Excel file appears to be empty');
      }

      setExcelData(jsonData);
      setExcelColumns(Object.keys(jsonData[0]));
      
      toast({
        title: 'Success',
        description: `Loaded ${jsonData.length} records from Excel file`,
      });
    } catch (error) {
      console.error('Error reading Excel file:', error);
      toast({
        title: 'Error',
        description: 'Failed to read Excel file. Please check the file format.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const updatePlaceholderMapping = (placeholder: string, column: string) => {
    setPlaceholderMapping(prev => ({
      ...prev,
      [placeholder]: column,
    }));
  };

  const canGenerate = () => {
    if (!selectedTemplate || excelData.length === 0) return false;
    
    // Check if all placeholders are mapped
    return selectedTemplate.placeholders.every(placeholder => 
      placeholderMapping[placeholder] && placeholderMapping[placeholder] !== ''
    );
  };

  const onSubmit = async (formData: GenerateForm) => {
    if (!user || !selectedTemplate || !canGenerate()) return;

    setLoading(true);
    try {
      // Create the batch
      const { data: batch, error: batchError } = await supabase
        .from('certificate_batches')
        .insert({
          user_id: user.id,
          template_id: formData.template_id,
          batch_name: formData.batch_name,
          total_certificates: excelData.length,
          status: 'pending',
        })
        .select()
        .single();

      if (batchError) throw batchError;

      // Create individual certificate records
      const certificates = excelData.map(row => {
        const certificateData: Record<string, any> = {};
        
        // Map Excel columns to template placeholders
        selectedTemplate.placeholders.forEach(placeholder => {
          const columnName = placeholderMapping[placeholder];
          if (columnName && row[columnName] !== undefined) {
            certificateData[placeholder] = row[columnName];
          }
        });

        return {
          batch_id: batch.id,
          user_id: user.id,
          recipient_name: certificateData.recipientName || certificateData.name || 'Unknown',
          recipient_email: certificateData.email || null,
          certificate_data: certificateData,
          status: 'pending' as const,
        };
      });

      const { error: certificatesError } = await supabase
        .from('certificates')
        .insert(certificates);

      if (certificatesError) throw certificatesError;

      toast({
        title: 'Success',
        description: `Batch "${formData.batch_name}" created with ${certificates.length} certificates`,
      });

      navigate('/history');
    } catch (error) {
      console.error('Error creating batch:', error);
      toast({
        title: 'Error',
        description: 'Failed to create certificate batch',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Generate Certificates</h1>
          <p className="text-muted-foreground">
            Create certificates in bulk using your templates and Excel data
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Step 1: Select Template */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3">1</span>
                Select Template
              </CardTitle>
              <CardDescription>
                Choose the certificate template you want to use
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="template">Template</Label>
                  <Select onValueChange={(value) => form.setValue('template_id', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{template.name}</span>
                            <Badge variant="outline" className="ml-2">
                              {template.placeholders.length} placeholders
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.template_id && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.template_id.message}
                    </p>
                  )}
                </div>

                {selectedTemplate && (
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Template Placeholders:</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedTemplate.placeholders.map((placeholder) => (
                        <Badge key={placeholder} variant="secondary">
                          {placeholder}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="batch_name">Batch Name</Label>
                  <Input
                    id="batch_name"
                    placeholder="Enter batch name (e.g., 'Q1 2024 Graduates')"
                    {...form.register('batch_name')}
                  />
                  {form.formState.errors.batch_name && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.batch_name.message}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Upload Excel File */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3">2</span>
                Upload Excel File
              </CardTitle>
              <CardDescription>
                Upload an Excel file containing the data for your certificates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                  <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <div className="space-y-2">
                    <Label htmlFor="excel-file" className="cursor-pointer">
                      <span className="text-sm font-medium">Choose Excel file</span>
                      <Input
                        id="excel-file"
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Supports .xlsx, .xls, and .csv files
                    </p>
                  </div>
                </div>

                {uploading && (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2"></div>
                    <span className="text-sm">Processing file...</span>
                  </div>
                )}

                {excelData.length > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Successfully loaded {excelData.length} records with columns: {excelColumns.join(', ')}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Step 3: Map Placeholders */}
          {selectedTemplate && excelData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3">3</span>
                  Map Data Fields
                </CardTitle>
                <CardDescription>
                  Map your Excel columns to template placeholders
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {selectedTemplate.placeholders.map((placeholder) => (
                    <div key={placeholder} className="flex items-center space-x-4">
                      <div className="w-32">
                        <Badge variant="outline">{placeholder}</Badge>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <Select
                          onValueChange={(value) => updatePlaceholderMapping(placeholder, value)}
                          value={placeholderMapping[placeholder] || ''}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Excel column" />
                          </SelectTrigger>
                          <SelectContent>
                            {excelColumns.map((column) => (
                              <SelectItem key={column} value={column}>
                                {column}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Preview */}
                {canGenerate() && excelData.length > 0 && (
                  <div className="mt-6 p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Preview (First Record):</h4>
                    <div className="text-sm space-y-1">
                      {selectedTemplate.placeholders.map((placeholder) => {
                        const columnName = placeholderMapping[placeholder];
                        const value = columnName ? excelData[0][columnName] : '';
                        return (
                          <div key={placeholder} className="flex">
                            <span className="font-medium w-32">{placeholder}:</span>
                            <span>{value}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Generate Button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!canGenerate() || loading}
              size="lg"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating Batch...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Generate {excelData.length} Certificates
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};