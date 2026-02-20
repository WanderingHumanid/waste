'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, Loader2, ImagePlus, Pencil } from 'lucide-react'
import { MarketplaceItem } from '@/types/marketplace'

const itemSchema = z.object({
    title: z.string().min(3, 'Title must be at least 3 characters'),
    description: z.string().optional(),
    category: z.enum(['cement', 'rebars', 'bricks', 'tiles', 'sand', 'gravel', 'wood', 'metal', 'other']),
    quantity: z.string().min(1, 'Quantity is required'),
    price: z.coerce.number().min(0, 'Price must be non-negative'),
    location: z.string().optional(),
})

type ItemFormValues = z.infer<typeof itemSchema>

interface MarketplaceItemDialogProps {
    itemToEdit?: MarketplaceItem
    trigger?: React.ReactNode
    onSuccess?: () => void
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function MarketplaceItemDialog({
    itemToEdit,
    trigger,
    onSuccess,
    open: controlledOpen,
    onOpenChange: setControlledOpen
}: MarketplaceItemDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : internalOpen
    const setOpen = (value: boolean) => {
        if (isControlled) setControlledOpen?.(value)
        else setInternalOpen(value)
    }

    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    const form = useForm<ItemFormValues>({
        resolver: zodResolver(itemSchema),
        defaultValues: {
            title: '',
            description: '',
            category: 'other',
            quantity: '',
            price: 0,
            location: '',
        },
    })

    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(null)

    // Reset form when itemToEdit changes or dialog opens
    useEffect(() => {
        if (open) {
            if (itemToEdit) {
                form.reset({
                    title: itemToEdit.title,
                    description: itemToEdit.description,
                    category: itemToEdit.category as any,
                    quantity: itemToEdit.quantity,
                    price: itemToEdit.price,
                    location: itemToEdit.fuzzy_location,
                })
                if (itemToEdit.images && itemToEdit.images.length > 0) {
                    setImagePreview(itemToEdit.images[0])
                } else {
                    setImagePreview(null)
                }
            } else {
                form.reset({
                    title: '',
                    description: '',
                    category: 'other',
                    quantity: '',
                    price: 0,
                    location: '',
                })
                setImagePreview(null)
            }
            setImageFile(null)
        }
    }, [open, itemToEdit, form])

    async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (file) {
            setImageFile(file)
            const reader = new FileReader()
            reader.onloadend = () => {
                setImagePreview(reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    async function onSubmit(data: ItemFormValues) {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                toast.error('You must be logged in')
                return
            }

            let imageUrls: string[] = itemToEdit?.images || []

            // If a new image is selected, upload it
            if (imageFile) {
                const fileExt = imageFile.name.split('.').pop()
                const fileName = `${user.id}/${Date.now()}.${fileExt}`

                // Use 'reports' bucket as configured in user's project
                const { error: uploadError } = await supabase.storage
                    .from('reports')
                    .upload(fileName, imageFile)

                if (uploadError) {
                    console.error('Upload error:', uploadError)
                    toast.error('Failed to upload image')
                    setLoading(false)
                    return
                }

                const { data: { publicUrl } } = supabase.storage
                    .from('reports')
                    .getPublicUrl(fileName)

                // Replace existing image with new one (single image support for now)
                imageUrls = [publicUrl]
            }

            const itemData = {
                title: data.title,
                description: data.description,
                category: data.category,
                quantity: data.quantity,
                price: data.price,
                fuzzy_location: data.location || 'Your Area',
                images: imageUrls
            }

            let error;
            if (itemToEdit) {
                // Update existing item
                const { error: updateError } = await supabase
                    .from('marketplace_items')
                    .update(itemData)
                    .eq('id', itemToEdit.id)
                    .eq('user_id', user.id) // Security check
                error = updateError
            } else {
                // Insert new item
                const { error: insertError } = await supabase
                    .from('marketplace_items')
                    .insert({
                        user_id: user.id,
                        is_available: true,
                        ...itemData
                    })
                error = insertError
            }

            if (error) throw error

            toast.success(itemToEdit ? 'Item updated!' : 'Item listed successfully!')
            setOpen(false)
            onSuccess?.()

        } catch (error) {
            console.error('Error saving item:', error)
            toast.error('Failed to save listing')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button className="gap-2">
                        <Plus className="w-4 h-4" />
                        List Item
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] overflow-y-auto max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>{itemToEdit ? 'Edit Listing' : 'List an Item'}</DialogTitle>
                    <DialogDescription>
                        {itemToEdit ? 'Update your listing details.' : 'Share surplus materials with your community.'}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                        {/* Image Upload */}
                        <div className="flex flex-col gap-2">
                            <FormLabel>Item Image</FormLabel>
                            <div className="flex items-center gap-4">
                                {imagePreview ? (
                                    <div className="relative w-20 h-20 rounded-md overflow-hidden border">
                                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="absolute top-0 right-0 h-6 w-6 bg-background/50 hover:bg-background"
                                            onClick={() => {
                                                setImageFile(null)
                                                // If editing, reverting to no image might not be desired, but for now clear preview
                                                // If they save, it will keep existing if imageFile is null, unless we explicitly clear it.
                                                // Current logic: if imageFile is null, we keep itemToEdit.images. 
                                                // To support deleting image, we'd need more logic. 
                                                // For now, X just clears the *new* selection or the preview.
                                                if (imageFile) {
                                                    setImagePreview(itemToEdit?.images?.[0] || null)
                                                } else {
                                                    // They are clearing the existing image?
                                                    // Let's just allow clearing the preview for new uploads
                                                    setImagePreview(null)
                                                }
                                            }}
                                        >
                                            <div className="h-4 w-4">×</div>
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="w-20 h-20 rounded-md border border-dashed flex items-center justify-center bg-muted/50">
                                        <ImagePlus className="w-8 h-8 text-muted-foreground/50" />
                                    </div>
                                )}
                                <div className="flex-1">
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        className="mb-1"
                                    />
                                    <FormDescription className="text-xs">
                                        {itemToEdit ? 'Upload to replace existing image' : 'Upload a photo of the item'}
                                    </FormDescription>
                                </div>
                            </div>
                        </div>

                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Title</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. 50 Bricks" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Category</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a category" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="cement">Cement</SelectItem>
                                            <SelectItem value="bricks">Bricks</SelectItem>
                                            <SelectItem value="tiles">Tiles</SelectItem>
                                            <SelectItem value="wood">Wood</SelectItem>
                                            <SelectItem value="metal">Metal</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="quantity"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Quantity</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. 10 kg" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="price"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Price (₹)</FormLabel>
                                        <FormControl>
                                            <Input type="number" placeholder="0 for Free" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Add details..."
                                            className="resize-none"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="submit" disabled={loading}>
                                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                {itemToEdit ? 'Save Changes' : 'Post Listing'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}

// For backward compatibility if needed, or just export alias
export { MarketplaceItemDialog as CreateItemDialog }
