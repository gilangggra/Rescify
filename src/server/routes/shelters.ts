import { Router } from 'express';
import {
  createShelter,
  deleteShelter,
  getAllShelters,
  getShelterById,
  updateShelter,
} from '../controllers/sheltersController';

const router = Router();

router.get('/', getAllShelters);
router.get('/:id', getShelterById);
router.post('/', createShelter);
router.put('/:id', updateShelter);
router.delete('/:id', deleteShelter);

export default router;
